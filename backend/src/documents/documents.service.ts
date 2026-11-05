import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Brackets, DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import {
  canDeleteDocument,
  canReadDocument,
  ROLE_CLEARANCE,
} from '../authz/permissions';
import { Errors } from '../common/api-error';
import type { AuthContext } from '../common/request-context';
import { IntegrityError } from '../crypto/aead';
import { DocumentEntity, DocumentFavoriteEntity } from '../database/entities';
import { DocumentCryptoService } from './document-crypto.service';
import {
  DocumentDto,
  ListDocumentsQuery,
  SORTS,
  UploadDocumentDto,
} from './dto';
import { validateUpload } from './file-validation';
import { StorageService } from './storage.service';

type Meta = { ip: string | null; requestId: string | null };
type Row = DocumentEntity & { ownerName: string; favorite: boolean };

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger('Documents');

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly docs: Repository<DocumentEntity>,
    @InjectRepository(DocumentFavoriteEntity)
    private readonly favorites: Repository<DocumentFavoriteEntity>,
    private readonly storage: StorageService,
    private readonly crypto: DocumentCryptoService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  private toDto(row: Row, auth: AuthContext): DocumentDto {
    return {
      id: row.id,
      title: row.title,
      filename: row.originalFilename,
      mimeType: row.mimeType,
      size: row.sizeBytes,
      classification: row.classification,
      sha256: row.sha256,
      owner: { id: row.ownerId, displayName: row.ownerName },
      favorite: row.favorite,
      permissions: {
        canDownload: true,
        canDelete: canDeleteDocument(auth, row),
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Consulta base con la política de lectura por objeto aplicada en SQL. */
  private visibleQuery(auth: AuthContext) {
    const qb = this.docs
      .createQueryBuilder('d')
      .innerJoin('d.owner', 'o')
      .leftJoin(
        DocumentFavoriteEntity,
        'f',
        'f.document_id = d.id AND f.user_id = :uid',
        { uid: auth.userId },
      )
      .addSelect('o.display_name', 'ownerName')
      .addSelect('CASE WHEN f.user_id IS NULL THEN 0 ELSE 1 END', 'favorite');
    if (auth.role !== 'admin') {
      qb.where(
        new Brackets((b) =>
          b
            .where('d.owner_id = :uid')
            .orWhere('d.classification IN (:...clearance)', {
              clearance: ROLE_CLEARANCE[auth.role],
            }),
        ),
      );
    }
    return qb;
  }

  private async rows(
    qb: ReturnType<DocumentsService['visibleQuery']>,
  ): Promise<Row[]> {
    const { entities, raw } = await qb.getRawAndEntities<{
      ownerName: string;
      favorite: string | number;
    }>();
    return entities.map((e) => {
      const r =
        raw.find((x) => (x as Record<string, unknown>).d_id === e.id) ?? raw[0];
      return Object.assign(e, {
        ownerName: r.ownerName,
        favorite: Number(r.favorite) === 1,
      });
    });
  }

  async list(auth: AuthContext, q: ListDocumentsQuery) {
    const qb = this.visibleQuery(auth);
    if (q.search) {
      const term = `%${q.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere('(d.title LIKE :term OR d.original_filename LIKE :term)', {
        term,
      });
    }
    if (q.classification)
      qb.andWhere('d.classification = :cls', { cls: q.classification });
    if (q.favorite === true) qb.andWhere('f.user_id IS NOT NULL');
    if (q.favorite === false) qb.andWhere('f.user_id IS NULL');
    if (q.scope === 'mine') qb.andWhere('d.owner_id = :uid');
    const total = await qb.clone().getCount();
    qb.orderBy(SORTS[q.sort], q.order === 'asc' ? 'ASC' : 'DESC')
      .addOrderBy('d.id', 'ASC')
      .offset((q.page - 1) * q.pageSize)
      .limit(q.pageSize);
    const items = (await this.rows(qb)).map((r) => this.toDto(r, auth));
    return { items, total };
  }

  /** 404 tanto si no existe como si no es visible: no revela existencia. */
  async findVisible(auth: AuthContext, id: string): Promise<Row> {
    const [row] = await this.rows(
      this.visibleQuery(auth).andWhere('d.id = :id', { id }),
    );
    if (!row || !canReadDocument(auth, row)) throw Errors.notFound('Documento');
    return row;
  }

  async get(auth: AuthContext, id: string) {
    return this.toDto(await this.findVisible(auth, id), auth);
  }

  async upload(
    auth: AuthContext,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    dto: UploadDocumentDto,
    maxBytes: number,
    meta: Meta,
  ): Promise<DocumentDto> {
    const base = {
      actorId: auth.userId,
      actorEmail: auth.email,
      resourceType: 'document',
      ...meta,
    };
    let validated;
    try {
      validated = validateUpload(file, maxBytes);
    } catch (e) {
      await this.audit.record({
        ...base,
        action: 'document.upload',
        outcome: 'failure',
        details: { reason: (e as { code?: string }).code ?? 'invalid' },
      });
      throw e;
    }
    const id = randomUUID();
    const enc = this.crypto.encrypt(id, file.buffer);
    const now = new Date();
    try {
      await this.storage.write(id, enc.ciphertext);
    } catch (e) {
      this.logger.error(`Fallo de escritura ${(e as Error).name} id=${id}`);
      await this.audit.record({
        ...base,
        action: 'document.upload',
        outcome: 'failure',
        resourceId: id,
        details: { reason: 'storage' },
      });
      throw Errors.storage();
    }
    try {
      await this.docs.insert({
        id,
        ownerId: auth.userId,
        title: dto.title,
        originalFilename: validated.filename,
        mimeType: validated.mimeType,
        sizeBytes: file.buffer.length,
        classification: dto.classification,
        sha256: enc.sha256,
        nonce: enc.nonce,
        authTag: enc.authTag,
        wrappedKey: enc.wrappedKey,
        keyId: enc.keyId,
        encryptionVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      // Compensación: no dejar texto cifrado huérfano si falla la BD.
      await this.storage.remove(id).catch(() => undefined);
      this.logger.error(
        `Fallo al registrar documento ${(e as Error).name} id=${id}`,
      );
      await this.audit.record({
        ...base,
        action: 'document.upload',
        outcome: 'failure',
        resourceId: id,
        details: { reason: 'database' },
      });
      throw e;
    }
    await this.audit.record({
      ...base,
      action: 'document.upload',
      outcome: 'success',
      resourceId: id,
      details: {
        classification: dto.classification,
        size: file.buffer.length,
        mime: validated.mimeType,
      },
    });
    return this.get(auth, id);
  }

  async download(auth: AuthContext, id: string, meta: Meta) {
    const row = await this.findVisible(auth, id);
    const base = {
      actorId: auth.userId,
      actorEmail: auth.email,
      resourceType: 'document',
      resourceId: id,
      ...meta,
    };
    let ciphertext: Buffer;
    try {
      ciphertext = await this.storage.read(id);
    } catch {
      await this.audit.record({
        ...base,
        action: 'document.integrity_failed',
        outcome: 'failure',
        details: { reason: 'missing_blob' },
      });
      throw Errors.integrity();
    }
    try {
      const content = this.crypto.decrypt(id, row, ciphertext);
      await this.audit.record({
        ...base,
        action: 'document.download',
        outcome: 'success',
      });
      return { content, row };
    } catch (e) {
      if (!(e instanceof IntegrityError)) throw e;
      await this.audit.record({
        ...base,
        action: 'document.integrity_failed',
        outcome: 'failure',
        details: { reason: 'auth_tag_or_hash' },
      });
      throw Errors.integrity();
    }
  }

  async remove(auth: AuthContext, id: string, meta: Meta) {
    const row = await this.findVisible(auth, id);
    const base = {
      actorId: auth.userId,
      actorEmail: auth.email,
      resourceType: 'document',
      resourceId: id,
      ...meta,
    };
    if (!canDeleteDocument(auth, row)) {
      await this.audit.record({
        ...base,
        action: 'document.delete',
        outcome: 'denied',
      });
      throw Errors.forbidden();
    }
    // Borrar el registro (con su DEK envuelta) primero: aunque el archivo no
    // pudiera eliminarse, el texto cifrado queda irrecuperable.
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(DocumentFavoriteEntity).delete({ documentId: id });
      await m.getRepository(DocumentEntity).delete({ id });
    });
    try {
      await this.storage.remove(id);
    } catch (e) {
      this.logger.warn(
        `Archivo cifrado huérfano id=${id} (${(e as Error).name})`,
      );
    }
    await this.audit.record({
      ...base,
      action: 'document.delete',
      outcome: 'success',
      details: { classification: row.classification },
    });
  }

  async setFavorite(auth: AuthContext, id: string, favorite: boolean) {
    await this.findVisible(auth, id);
    if (favorite)
      await this.favorites.upsert(
        { userId: auth.userId, documentId: id, createdAt: new Date() },
        ['userId', 'documentId'],
      );
    else await this.favorites.delete({ userId: auth.userId, documentId: id });
  }
}
