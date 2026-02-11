import { Controller, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Google ────────────────────────────────────────
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Passport redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req, @Res() res) {
    const token = await this.authService.oauthLogin(req.user);
    res.cookie('access_token', token.accessToken, {
      httpOnly: true,
      secure: true, // ← now required
      sameSite: 'none',
      path: '/',
    });
    return res.redirect(`http://localhost:3000/dashboard`);
  }

  // ── GitHub ────────────────────────────────────────
  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubLogin() {
    // Passport redirects to GitHub
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req, @Res() res) {
    const result = await this.authService.oauthLogin(req.user);
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: true, // ← now required
      sameSite: 'none',
      path: '/',
    });
    return res.redirect(`http://localhost:3000/dashboard`);
  }
}
