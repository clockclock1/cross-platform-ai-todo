import nodemailer from 'nodemailer';
import { MailConfig } from './types.js';

function maskSecret(value: string) {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

export function publicMailConfig(mail: MailConfig): MailConfig {
  return {
    ...mail,
    netease: { ...mail.netease, pass: mail.netease.pass ? maskSecret(mail.netease.pass) : '' },
    microsoft: { ...mail.microsoft, pass: mail.microsoft.pass ? maskSecret(mail.microsoft.pass) : '' },
    resend: { apiKey: mail.resend.apiKey ? maskSecret(mail.resend.apiKey) : '' },
  };
}

export function mergeMailSecrets(current: MailConfig, incoming: MailConfig): MailConfig {
  const next: MailConfig = {
    ...current,
    ...incoming,
    netease: { ...current.netease, ...incoming.netease },
    microsoft: { ...current.microsoft, ...incoming.microsoft },
    resend: { ...current.resend, ...incoming.resend },
  };
  if (incoming.netease?.pass && incoming.netease.pass.includes('****')) {
    next.netease.pass = current.netease.pass;
  }
  if (incoming.microsoft?.pass && incoming.microsoft.pass.includes('****')) {
    next.microsoft.pass = current.microsoft.pass;
  }
  if (incoming.resend?.apiKey && incoming.resend.apiKey.includes('****')) {
    next.resend.apiKey = current.resend.apiKey;
  }
  return next;
}

function buildHtml(title: string, body: string) {
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#0b0c10;color:#e8eef8;padding:24px;">
  <div style="max-width:480px;margin:0 auto;border:1px solid #2a3144;padding:24px;background:#12141d;">
    <h2 style="margin:0 0 12px;font-size:18px;">${title}</h2>
    <p style="line-height:1.7;color:#c5d0e0;">${body}</p>
  </div>
</body></html>`;
}

async function sendViaSmtp(opts: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const transporter = nodemailer.createTransport({
    host: opts.host,
    port: opts.port,
    secure: opts.secure,
    auth: { user: opts.user, pass: opts.pass },
  });
  await transporter.sendMail({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}

async function sendViaResend(apiKey: string, from: string, to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Resend 发送失败 (${res.status})`);
  }
}

export async function sendMail(mail: MailConfig, to: string, subject: string, body: string) {
  if (!mail.enabled) {
    throw new Error('邮件发件未启用，请先在管理后台配置 SMTP 渠道');
  }
  const fromEmail = mail.fromEmail || (
    mail.channel === 'netease' ? mail.netease.user :
    mail.channel === 'microsoft' ? mail.microsoft.user :
    ''
  );
  if (!fromEmail) {
    throw new Error('发件邮箱未配置');
  }
  const from = mail.fromName ? `${mail.fromName} <${fromEmail}>` : fromEmail;
  const html = buildHtml(subject, body);

  if (mail.channel === 'resend') {
    if (!mail.resend.apiKey) throw new Error('Resend API Key 未配置');
    await sendViaResend(mail.resend.apiKey, from, to, subject, html);
    return;
  }

  if (mail.channel === 'netease') {
    if (!mail.netease.user || !mail.netease.pass) throw new Error('网易邮箱账号或授权码未配置');
    await sendViaSmtp({
      host: mail.netease.host || 'smtp.163.com',
      port: mail.netease.port || 465,
      secure: mail.netease.secure !== false,
      user: mail.netease.user,
      pass: mail.netease.pass,
      from,
      to,
      subject,
      html,
    });
    return;
  }

  if (mail.channel === 'microsoft') {
    if (!mail.microsoft.user || !mail.microsoft.pass) throw new Error('微软邮箱账号或密码未配置');
    await sendViaSmtp({
      host: mail.microsoft.host || 'smtp.office365.com',
      port: mail.microsoft.port || 587,
      secure: Boolean(mail.microsoft.secure),
      user: mail.microsoft.user,
      pass: mail.microsoft.pass,
      from,
      to,
      subject,
      html,
    });
    return;
  }

  throw new Error('未知发件渠道');
}

export async function sendVerificationCode(mail: MailConfig, to: string, code: string) {
  await sendMail(
    mail,
    to,
    'AI 待办注册验证码',
    `您的邮箱验证码是 <strong style="font-size:22px;letter-spacing:4px;">${code}</strong>，10 分钟内有效。如果不是您本人操作，请忽略此邮件。`
  );
}
