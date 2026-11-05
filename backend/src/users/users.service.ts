import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../authz/permissions';
import { Errors } from '../common/api-error';
import { UserEntity } from '../database/entities';
import { hashPassword, passwordPolicyError } from '../auth/password';
import { SessionService } from '../auth/session.service';
import { ListUsersQuery, UpdateUserDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly sessions: SessionService,
    private readonly dataSource: DataSource,
  ) {}

  findById(id: string) {
    return this.users.findOneBy({ id });
  }

  findByEmail(email: string) {
    return this.users.findOneBy({ email: email.trim().toLowerCase() });
  }

  /** Crea un usuario. El rol lo decide el servidor, nunca el cliente público. */
  async create(input: {
    email: string;
    displayName: string;
    password: string;
    role: Role;
  }): Promise<UserEntity> {
    const policy = passwordPolicyError(input.password, input.email);
    if (policy)
      throw Errors.validation([{ field: 'password', message: policy }]);
    const now = new Date();
    const user = this.users.create({
      id: randomUUID(),
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName.trim(),
      passwordHash: await hashPassword(input.password),
      role: input.role,
      status: 'active',
      failedLoginCount: 0,
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecretEnc: null,
      mfaPendingSecretEnc: null,
      mfaLastUsedStep: null,
      createdAt: now,
      updatedAt: now,
    });
    try {
      await this.users.insert(user);
    } catch (e) {
      if ((e as { code?: string }).code === 'ER_DUP_ENTRY')
        throw Errors.conflict(
          'EMAIL_ALREADY_REGISTERED',
          'El correo ya está registrado.',
        );
      throw e;
    }
    return user;
  }

  async list(q: ListUsersQuery) {
    const qb = this.users
      .createQueryBuilder('u')
      .orderBy('u.created_at', 'DESC');
    if (q.search) {
      // LIKE parametrizado; se escapan los comodines del usuario.
      const term = `%${q.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.where('(u.email LIKE :term OR u.display_name LIKE :term)', { term });
    }
    const [items, total] = await qb
      .skip((q.page - 1) * q.pageSize)
      .take(q.pageSize)
      .getManyAndCount();
    return { items, total };
  }

  /**
   * Cambia rol/estado. Reglas contra escalamiento y bloqueo:
   * nadie se modifica a sí mismo y siempre queda al menos un admin activo.
   */
  async update(actorId: string, targetId: string, dto: UpdateUserDto) {
    if (dto.role === undefined && dto.status === undefined)
      throw Errors.validation([
        { field: 'role', message: 'Indicar role o status' },
      ]);
    if (actorId === targetId)
      throw Errors.conflict(
        'SELF_MODIFICATION',
        'No puedes cambiar tu propio rol o estado.',
      );

    const result = await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(UserEntity);
      const target = await repo.findOne({
        where: { id: targetId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!target) throw Errors.notFound('Usuario');
      const before = { role: target.role, status: target.status };
      const removesAdmin =
        target.role === 'admin' &&
        target.status === 'active' &&
        ((dto.role !== undefined && dto.role !== 'admin') ||
          dto.status === 'disabled');
      if (removesAdmin) {
        const admins = await repo.count({
          where: { role: 'admin', status: 'active' },
        });
        if (admins <= 1)
          throw Errors.conflict(
            'LAST_ADMIN',
            'Debe existir al menos un administrador activo.',
          );
      }
      if (dto.role !== undefined) target.role = dto.role;
      if (dto.status !== undefined) target.status = dto.status;
      target.updatedAt = new Date();
      await repo.save(target);
      return { target, before };
    });
    // Revocar sesiones para que el cambio de privilegios aplique de inmediato.
    await this.sessions.revokeAllForUser(targetId);
    return result;
  }
}
