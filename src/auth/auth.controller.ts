import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { loginSchema, signupSchema } from './schema/auth.schema.js';
import { SignInDto, SignUpDto } from './dto/create-auth.dto.js';

// Shared cookie config factory
const cookieOptions = (isProd: boolean) => ({
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
  maxAge: 60 * 60 * 1000, // 1 hour
});

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly isProd = process.env.NODE_ENV === 'production';

  constructor(private readonly authService: AuthService) {}

  // ── Local credentials ───────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiBody({ type: SignInDto })
  @ApiResponse({ status: 200, description: 'Sign-in successful' })
  @ApiResponse({ status: 400, description: 'Invalid email or password' })
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body({ schema: loginSchema }) dto: SignInDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.authService.signIn(dto.email, dto.password);

    res.cookie('access_token', result.accessToken, cookieOptions(this.isProd));
    res.status(HttpStatus.OK).json({
      message: 'Sign-in successful',
      user: result.user,
    });
  }

  @ApiOperation({ summary: 'Register a new account' })
  @ApiBody({ type: SignUpDto })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(
    @Body({ schema: signupSchema }) dto: SignUpDto,
  ): Promise<{ message: string; data: Record<string, unknown> }> {
    return this.authService.signUp(dto);
  }

  // ── Google OAuth ────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(): void {
    // Passport redirects to Google — no body needed
  }

  @ApiOperation({ summary: 'Google OAuth callback' })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.authService.oauthLogin(req.user as any);
    res.cookie('access_token', result.accessToken, cookieOptions(this.isProd));
    res.redirect(
      `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/dashboard`,
    );
  }

  // ── GitHub OAuth ────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Initiate GitHub OAuth flow' })
  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubLogin(): void {
    // Passport redirects to GitHub — no body needed
  }

  @ApiOperation({ summary: 'GitHub OAuth callback' })
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.authService.oauthLogin(req.user as any);
    res.cookie('access_token', result.accessToken, cookieOptions(this.isProd));
    res.redirect(
      `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/dashboard`,
    );
  }

  // ── Sign out ────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Sign out (clear auth cookie)' })
  @ApiResponse({ status: 200, description: 'Signed out successfully' })
  @Post('signout')
  @HttpCode(HttpStatus.OK)
  signOut(@Res() res: Response): void {
    res.clearCookie('access_token', { path: '/' });
    res.status(HttpStatus.OK).json({ message: 'Signed out successfully' });
  }
}
