// Shared email template utilities with VALUATION branding
// Cores primárias: preto (#1a1a1a) e dourado (#D4A506)
// URL pública da logo VALUATION
const LOGO_URL = "https://valuationit.com.br/logo.webp";

/**
 * Generates a standardized email header with VALUATION logo
 * Uses white background with dark text for optimal logo visibility
 */
export function generateEmailHeader(
  title: string, 
  headerColor: string = "#ffffff", 
  icon?: string
): string {
  return `
    <div style="background: ${headerColor}; color: #1a1a1a; padding: 40px 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
      <img src="${LOGO_URL}" alt="VALUATION Invest Tech" style="max-width: 180px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
      ${icon ? `<div style="font-size: 48px; margin-bottom: 15px;">${icon}</div>` : ''}
      <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1a1a1a;">${title}</h1>
    </div>
  `;
}

/**
 * Generates a premium email footer with VALUATION branding
 * Uses dark background with gold accents for premium feel
 */
export function generateEmailFooter(year?: number): string {
  const currentYear = year || new Date().getFullYear();
  return `
    <div style="text-align: center; padding: 24px; background: #1a1a1a; color: #ffffff; font-size: 12px;">
      <img src="${LOGO_URL}" alt="VALUATION" style="max-width: 100px; height: auto; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;">
      <p style="margin: 0 0 5px 0;"><strong style="color: #D4A506;">VALUATION Invest Tech</strong></p>
      <p style="margin: 0 0 5px 0; color: #cccccc;">Este é um e-mail automático, por favor não responda.</p>
      <p style="margin: 0; color: #999999;">© ${currentYear} VALUATION Invest Tech. Todos os direitos reservados.</p>
    </div>
  `;
}

/**
 * Generates a complete email wrapper with header and footer
 */
export function generateEmailWrapper(
  title: string,
  content: string,
  headerColor: string = "#ffffff",
  icon?: string
): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f8;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">
          <tr>
            <td>
              ${generateEmailHeader(title, headerColor, icon)}
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td>
              ${generateEmailFooter()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Generates a CTA button for emails using primary brand colors
 * Primary: dark gradient (black/gray)
 */
export function generateCTAButton(text: string, url: string, color: string = "linear-gradient(135deg, #1a1a1a 0%, #333333 100%)"): string {
  return `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${url}" style="display: inline-block; padding: 14px 32px; background: ${color}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
        ${text}
      </a>
    </div>
  `;
}

/**
 * Generates a gold accent CTA button
 */
export function generateGoldCTAButton(text: string, url: string): string {
  return `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${url}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #D4A506 0%, #B8920A 100%); color: #1a1a1a; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(212,165,6,0.3);">
        ${text}
      </a>
    </div>
  `;
}

export { LOGO_URL };
