import nodemailer from 'nodemailer';
import { EmailConfig } from '@remote-claude/core';
import { TemplateContent } from '../templates/engine';
import chalk from 'chalk';

export class EmailNotifier {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }

  /**
   * Send email notification
   */
  async send(content: TemplateContent): Promise<any> {
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: this.config.from,
        to: this.config.to,
        cc: this.config.cc,
        bcc: this.config.bcc,
        subject: content.subject || content.title || 'Remote Claude Notification',
        text: content.format === 'text' ? content.body : undefined,
        html: content.format === 'html' ? content.body : undefined,
      };

      // If markdown, convert to HTML (basic conversion)
      if (content.format === 'markdown') {
        mailOptions.html = this.markdownToHtml(content.body);
      }

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(chalk.green(`✅ Email sent to ${this.config.to.join(', ')}`));
      return result;
    } catch (error) {
      console.error(chalk.red('❌ Email sending failed:'), (error as Error).message);
      throw error;
    }
  }

  /**
   * Test email configuration
   */
  async test(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log(chalk.green('✅ Email configuration is valid'));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Email configuration test failed:'), (error as Error).message);
      return false;
    }
  }

  /**
   * Basic markdown to HTML conversion
   */
  private markdownToHtml(markdown: string): string {
    return markdown
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  /**
   * Close the transporter
   */
  close(): void {
    this.transporter.close();
  }
}