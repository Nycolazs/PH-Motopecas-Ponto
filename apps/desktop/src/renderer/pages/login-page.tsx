import { useState } from 'react';
import { Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from '../auth/use-auth.js';
import { authErrorMessage } from '../auth/auth-error.js';
import { Brand } from '../components/brand.js';
import { ThemeButton } from '../components/theme-button.js';

const loginSchema = z.object({
  login: z
    .string()
    .trim()
    .min(3, 'Informe um login com pelo menos 3 caracteres.')
    .max(64, 'O login deve ter no máximo 64 caracteres.'),
  password: z.string().min(1, 'Informe sua senha.').max(256, 'A senha informada é muito longa.'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage(): React.JSX.Element {
  const { login } = useAuth();
  const isDesktop = typeof window !== 'undefined' && window.phPonto !== undefined;
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ defaultValues: { login: '', password: '' } });

  const submit = async (values: LoginForm): Promise<void> => {
    setSubmitError(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'login' || field === 'password') setError(field, { message: issue.message });
      }
      return;
    }
    try {
      await login(parsed.data);
    } catch (error) {
      setSubmitError(authErrorMessage(error));
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel" aria-label="PH-Ponto">
        <Brand />
        <div>
          <p className="eyebrow">
            {isDesktop ? 'Colaborador' : 'Painel de Gestão · Administrador'}
          </p>
          <h1>{isDesktop ? 'Seu expediente, com clareza.' : 'Gestão e controle de ponto.'}</h1>
          <p>
            {isDesktop
              ? 'Registre seus horários e acompanhe sua jornada de forma simples e segura.'
              : 'Gerencie colaboradores, espelhos de ponto, escalas de trabalho e relatórios.'}
          </p>
        </div>
        <div className="security-note">
          <ShieldCheck aria-hidden="true" />
          <span>
            <strong>Acesso protegido</strong>
            {isDesktop
              ? 'Ambiente seguro para registro e acompanhamento de ponto.'
              : 'Painel exclusivo para administradores e gestores.'}
          </span>
        </div>
      </section>

      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-theme">
          <ThemeButton />
        </div>
        <form
          className="login-form"
          onSubmit={(event) => void handleSubmit(submit)(event)}
          noValidate
        >
          <div className="login-heading">
            <span className="section-icon" aria-hidden="true">
              <LockKeyhole />
            </span>
            <div>
              <p className="eyebrow">
                {isDesktop ? 'Área do Colaborador' : 'Área do Administrador'}
              </p>
              <h2 id="login-title">{isDesktop ? 'Bater Ponto' : 'Entrar no Painel'}</h2>
              <p>
                {isDesktop
                  ? 'Informe seu login e senha para acessar o ponto.'
                  : 'Informe suas credenciais de administrador.'}
              </p>
            </div>
          </div>

          {submitError !== null && (
            <div className="inline-message error" role="alert">
              {submitError}
            </div>
          )}

          <div className="field-group">
            <label htmlFor="login">Login</label>
            <input
              id="login"
              autoComplete="username"
              autoFocus
              aria-invalid={errors.login !== undefined}
              aria-describedby={errors.login === undefined ? undefined : 'login-error'}
              {...register('login')}
            />
            {errors.login !== undefined && (
              <p className="field-error" id="login-error">
                {errors.login.message}
              </p>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="password">Senha</label>
            <div className="password-input">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={errors.password !== undefined}
                aria-describedby={errors.password === undefined ? undefined : 'password-error'}
                {...register('password')}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
            {errors.password !== undefined && (
              <p className="field-error" id="password-error">
                {errors.password.message}
              </p>
            )}
          </div>

          <button className="primary-button login-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="spin" aria-hidden="true" /> : null}
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="login-footer">Uso interno · PH Motopeças</p>
      </section>
    </main>
  );
}
