import { Resend } from 'resend'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY não configurada.')
  return new Resend(key)
}

const FROM = process.env.SMTP_FROM ?? 'Sfera Multifranquias <noreply@sferamultifranquias.com.br>'

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Redefinição de senha — Sfera Multifranquias',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
        <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, #1d4ed8, #3b82f6); display: inline-flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: white; margin-bottom: 16px;">S</div>
            <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">Sfera Multifranquias</h1>
          </div>

          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 12px;">Redefinição de senha</h2>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            Olá, <strong>${name}</strong>. Recebemos uma solicitação para redefinir a senha da sua conta.
            Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.
          </p>

          <a href="${resetUrl}" style="display: block; text-align: center; padding: 14px 24px; background: linear-gradient(135deg, #1d4ed8, #3b82f6); color: white; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 600; margin-bottom: 24px;">
            Redefinir minha senha
          </a>

          <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 0;">
            Se você não solicitou a redefinição de senha, ignore este e-mail. Sua senha não será alterada.<br><br>
            Por segurança, não compartilhe este link com ninguém.
          </p>
        </div>
      </div>
    `,
  })
}
