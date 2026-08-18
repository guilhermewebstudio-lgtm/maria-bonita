const nodemailer = require('nodemailer');

// Se houver credenciais SMTP configuradas em .env, envia um email a sério.
// Caso contrário, escreve o conteúdo do email nos logs — assim dá para testar
// o fluxo completo sem teres de configurar já um serviço de email.
async function sendEmail(to, subject, text) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER) {
    console.log('\n----- EMAIL SIMULADO (SMTP não configurado) -----');
    console.log('Para:', to);
    console.log('Assunto:', subject);
    console.log('Corpo:\n' + text);
    console.log('---------------------------------------------------\n');
    return { simulated: true };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
  });

  await transporter.sendMail({
    from: SMTP_FROM || 'ola@mariabonita.pt',
    to,
    subject,
    text
  });

  return { simulated: false };
}

module.exports = { sendEmail };
