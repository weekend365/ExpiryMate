import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class RequestEmailVerificationDto {
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class VerifyEmailDto {
  @IsString()
  token!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class OAuthLoginDto {
  @IsString()
  providerToken!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  redirectUri?: string;

  /** Opaque server-issued state (required for Google/Kakao/Naver code exchange). */
  @IsOptional()
  @IsString()
  state?: string;
}

export class StartOAuthDto {
  @IsIn(["google", "kakao", "naver"])
  provider!: "google" | "kakao" | "naver";

  @IsString()
  returnUri!: string;
}

export class AdminClientDto {
  @IsOptional()
  @IsIn(["admin", "mobile"])
  clientType?: "admin" | "mobile";
}
