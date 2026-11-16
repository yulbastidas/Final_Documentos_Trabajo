// SecureDocs en Azure: una VM Ubuntu con Docker Compose (equivalente a infra/aws/securedocs.yaml).
// Crear este despliegue genera recursos facturables (VM, disco, IP, ACR Basic).
// Solo 80/443 quedan abiertos; la administración usa Run Command (sin SSH),
// los secretos viven en Key Vault y GitHub Actions entra con OIDC (sin claves).

@description('Región de Azure. Debe estar permitida por la suscripción de estudiante.')
param location string = resourceGroup().location

@description('Etiqueta DNS pública: <label>.<region>.cloudapp.azure.com')
@minLength(3)
@maxLength(40)
param dnsLabel string

@description('Correo para los avisos de vencimiento de Let\'s Encrypt.')
param certificateEmail string

@description('Object ID (Entra ID) de quien carga los secretos en Key Vault.')
param operatorPrincipalId string

@description('Tipo de principal del operador.')
@allowed(['User', 'ServicePrincipal', 'Group'])
param operatorPrincipalType string = 'User'

@description('Clave pública SSH exigida por Azure para VMs Linux. El puerto 22 permanece cerrado.')
@secure()
param adminSshPublicKey string

@description('Usuario local de la VM (sin contraseña; solo clave SSH y puerto 22 cerrado).')
param adminUsername string = 'securedocsadmin'

@description('Tamaño de la VM. Standard_B2als_v2 (2 vCPU, 4 GiB) alcanza para MySQL + API + portal; la serie B v1 no está disponible para Azure for Students.')
param vmSize string = 'Standard_B2als_v2'

@description('Repositorio de GitHub autorizado a desplegar (owner/repo).')
param githubRepository string = 'yulbastidas/Final_Documentos_Trabajo'

@description('Environment de GitHub Actions autorizado a desplegar.')
param githubEnvironment string = 'production'

@description('Sujeto OIDC con IDs inmutables que GitHub emite ahora: repo:<owner>@<ownerId>/<repo>@<repoId>:environment:<env>. Vacío para omitirlo.')
param githubImmutableSubject string = 'repo:yulbastidas@134234125/Final_Documentos_Trabajo@1445109005:environment:production'

var suffix = uniqueString(resourceGroup().id)
var vmName = 'securedocs-vm'
var acrName = 'securedocs${suffix}'
var keyVaultName = 'sd-kv-${suffix}'
var storageName = 'sdbackup${suffix}'
var backupContainer = 'backups'
var tags = {
  Project: 'SecureDocs'
  Environment: 'production'
}

var roles = {
  acrPull: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
  acrPush: '8311e382-0749-4cb8-b61a-304f252e45ec'
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
  keyVaultSecretsOfficer: 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
  storageBlobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  virtualMachineContributor: '9980e02c-c2be-4d73-94e8-173b1dc7cf3c'
  reader: 'acdd72a7-3385-48ef-bd42-f606fba81ae7'
}

// ---------- Red ----------
resource nsg 'Microsoft.Network/networkSecurityGroups@2024-01-01' = {
  name: 'securedocs-nsg'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'Allow-HTTPS'
        properties: {
          description: 'HTTPS público'
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'Allow-HTTP-Redirect-ACME'
        properties: {
          description: 'Redirección a HTTPS y validación ACME de Let\'s Encrypt'
          priority: 110
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: 'securedocs-vnet'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: ['10.20.0.0/16'] }
    subnets: [
      {
        name: 'app'
        properties: {
          addressPrefix: '10.20.1.0/24'
          networkSecurityGroup: { id: nsg.id }
        }
      }
    ]
  }
}

resource publicIp 'Microsoft.Network/publicIPAddresses@2024-01-01' = {
  name: 'securedocs-ip'
  location: location
  tags: tags
  sku: { name: 'Standard' }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: { domainNameLabel: dnsLabel }
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2024-01-01' = {
  name: 'securedocs-nic'
  location: location
  tags: tags
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          subnet: { id: vnet.properties.subnets[0].id }
          publicIPAddress: { id: publicIp.id }
        }
      }
    ]
  }
}

// ---------- Registro, secretos y respaldos ----------
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Cool'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    encryption: {
      keySource: 'Microsoft.Storage'
      services: { blob: { enabled: true } }
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 7 }
  }
}

resource backupsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: backupContainer
  properties: { publicAccess: 'None' }
}

resource backupLifecycle 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'expire-backups'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: { blobTypes: ['blockBlob'], prefixMatch: ['${backupContainer}/backups/'] }
            actions: { baseBlob: { delete: { daysAfterModificationGreaterThan: 35 } } }
          }
        }
      ]
    }
  }
}

// ---------- VM ----------
var cloudInit = replace(
  replace(
    replace(
      replace(
        replace(
          replace(loadTextContent('cloud-init.sh'), '__DOMAIN__', publicIp.properties.dnsSettings.fqdn),
          '__CERTIFICATE_EMAIL__',
          certificateEmail
        ),
        '__ACR_NAME__',
        acr.name
      ),
      '__ACR_LOGIN_SERVER__',
      acr.properties.loginServer
    ),
    '__KEY_VAULT_NAME__',
    keyVault.name
  ),
  '__BACKUP_ACCOUNT__',
  storage.name
)

resource vm 'Microsoft.Compute/virtualMachines@2024-03-01' = {
  name: vmName
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    hardwareProfile: { vmSize: vmSize }
    securityProfile: {
      securityType: 'TrustedLaunch'
      uefiSettings: { secureBootEnabled: true, vTpmEnabled: true }
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: 'ubuntu-24_04-lts'
        sku: 'server'
        version: 'latest'
      }
      osDisk: {
        name: 'securedocs-osdisk'
        createOption: 'FromImage'
        diskSizeGB: 32
        managedDisk: { storageAccountType: 'StandardSSD_LRS' }
        deleteOption: 'Delete'
      }
    }
    osProfile: {
      computerName: 'securedocs'
      adminUsername: adminUsername
      customData: base64(cloudInit)
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: {
          publicKeys: [
            {
              path: '/home/${adminUsername}/.ssh/authorized_keys'
              keyData: adminSshPublicKey
            }
          ]
        }
        patchSettings: { patchMode: 'ImageDefault' }
      }
    }
    networkProfile: {
      networkInterfaces: [{ id: nic.id }]
    }
    diagnosticsProfile: {
      bootDiagnostics: { enabled: true }
    }
  }
}

// ---------- Identidad de GitHub Actions (OIDC, sin secretos) ----------
resource githubIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'securedocs-github-deploy'
  location: location
  tags: tags
}

resource githubFederation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: githubIdentity
  name: 'github-${githubEnvironment}'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubRepository}:environment:${githubEnvironment}'
    audiences: ['api://AzureADTokenExchange']
  }
}

// GitHub emite el sujeto con IDs de propietario y repositorio (no cambia si se renombra).
resource githubFederationImmutable 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = if (!empty(githubImmutableSubject)) {
  parent: githubIdentity
  name: 'github-${githubEnvironment}-immutable'
  dependsOn: [githubFederation]
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: githubImmutableSubject
    audiences: ['api://AzureADTokenExchange']
  }
}

// ---------- Permisos mínimos ----------
resource vmAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, vm.id, roles.acrPull)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.acrPull)
    principalId: vm.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource vmSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, vm.id, roles.keyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
    principalId: vm.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource vmBackupWriter 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, vm.id, roles.storageBlobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageBlobDataContributor)
    principalId: vm.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource operatorSecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, operatorPrincipalId, roles.keyVaultSecretsOfficer)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsOfficer)
    principalId: operatorPrincipalId
    principalType: operatorPrincipalType
  }
}

resource githubAcrPush 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, githubIdentity.id, roles.acrPush)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.acrPush)
    principalId: githubIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource githubVmRunCommand 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vm.id, githubIdentity.id, roles.virtualMachineContributor)
  scope: vm
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.virtualMachineContributor)
    principalId: githubIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource githubGroupReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, githubIdentity.id, roles.reader)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.reader)
    principalId: githubIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------- Salidas (variables del workflow deploy-azure.yml) ----------
output publicOrigin string = 'https://${publicIp.properties.dnsSettings.fqdn}'
output publicIpAddress string = publicIp.properties.ipAddress
output vmName string = vm.name
output resourceGroupName string = resourceGroup().name
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output keyVaultName string = keyVault.name
output backupStorageAccount string = storage.name
output githubClientId string = githubIdentity.properties.clientId
output tenantId string = subscription().tenantId
output subscriptionId string = subscription().subscriptionId
