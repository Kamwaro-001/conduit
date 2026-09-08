import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepo.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOneBy({ email });
  }

  async create(data: {
    email: string;
    password_hash: string;
    role?: UserRole;
  }): Promise<User> {
    const user = this.usersRepo.create(data);
    return this.usersRepo.save(user);
  }

  // Convenience method used by the seed script
  async createWithPassword(
    email: string,
    password: string,
    role: UserRole = UserRole.USER,
  ): Promise<User> {
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    return this.create({ email, password_hash, role });
  }
}
