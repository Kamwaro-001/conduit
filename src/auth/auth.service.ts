import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import { UserRole } from '../users/entities/user.entity.js';
import bcrypt from 'bcrypt';

export interface AuthResponse {
  access_token: string;
  user: { id: string; email: string; role: UserRole };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.buildResponse(user.id, user.email, user.role);
  }

  async register(email: string, password: string): Promise<AuthResponse> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('Email already in use');

    const user = await this.usersService.createWithPassword(email, password);
    return this.buildResponse(user.id, user.email, user.role);
  }

  private buildResponse(
    id: string,
    email: string,
    role: UserRole,
  ): AuthResponse {
    const payload = { sub: id, email, role };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id, email, role },
    };
  }
}
