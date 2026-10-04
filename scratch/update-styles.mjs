import fs from 'fs';

const stylesPath = 'd:/METAL ENGR WEBSITE/src/styles.css';
let content = fs.readFileSync(stylesPath, 'utf8');

// Match the Footer section
const footerRegex = /\/\* Footer \*\/[\s\S]*?(?=\.route-transition)/;

const newFooterStyles = `/* Footer */
.site-footer {
  padding: clamp(60px, 8vw, 90px) 8vw 35px;
  background: #0d0e0e;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
}

.footer-top {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: clamp(28px, 4vw, 6vw);
  padding-bottom: 48px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.site-footer .brand {
  font-size: 26px;
  gap: 16px;
  line-height: 0.95;
}

.site-footer .brand-logo,
.site-footer .brand img {
  width: 72px;
  height: 72px;
  filter: drop-shadow(0 3px 12px rgba(0, 0, 0, 0.45));
}

.site-footer .brand b {
  letter-spacing: 1.6px;
  color: var(--copper-light, #e08b3e);
}

.footer-tagline {
  color: #cfd4d8;
  max-width: 440px;
  font-size: 16px;
  line-height: 1.6;
  margin: 0;
  font-weight: 400;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: clamp(16px, 2.5vw, 28px);
  justify-self: end;
}

.footer-socials {
  display: flex;
  align-items: center;
  gap: 12px;
}

.social-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #e6ebed;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.social-icon-btn:hover {
  background: rgba(184, 115, 51, 0.2);
  border-color: var(--copper-light, #e08b3e);
  color: var(--copper-light, #e08b3e);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(184, 115, 51, 0.35);
}

.footer-top .arrow-link {
  font-size: 15px;
  letter-spacing: 2px;
  padding-bottom: 8px;
  font-weight: 600;
  white-space: nowrap;
}

.footer-top .arrow-link svg {
  width: 18px;
  height: 18px;
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding-top: 28px;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 1.3px;
  color: #8c9397;
  flex-wrap: wrap;
}

.footer-bottom span,
.footer-bottom a {
  font-size: 13px;
  transition: color 0.2s ease;
}

.footer-bottom a:hover {
  color: var(--copper-light);
}

.footer-location {
  color: var(--copper-light) !important;
  font-weight: 600;
}

.footer-credit {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #8c9397;
}

.omnysync-link {
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #ffffff !important;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04));
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.25s ease !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.omnysync-link:hover {
  background: var(--copper, #b87333);
  border-color: var(--copper-light, #e08b3e);
  color: #ffffff !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(184, 115, 51, 0.4);
}

`;

if (!footerRegex.test(content)) {
  console.error("Footer styles regex did not match!");
  process.exit(1);
}

content = content.replace(footerRegex, newFooterStyles);

// Also update the responsive media query for .footer-top to support .footer-actions
const mqFooterRegex = /\.footer-top\s*\{[^}]*\}\s*\.site-footer\s*\{[^}]*\}/;
const newMqFooter = `.footer-top {
    grid-template-columns: 1fr;
    gap: 28px;
    padding-bottom: 36px;
  }

  .footer-actions {
    justify-self: start;
    flex-wrap: wrap;
    gap: 20px;
  }

  .site-footer {
    padding: 50px 6vw 25px;
  }`;

if (mqFooterRegex.test(content)) {
  content = content.replace(mqFooterRegex, newMqFooter);
}

// Update mobile .footer-bottom gap
const mobileFbRegex = /\.footer-bottom\s*\{\s*flex-direction:\s*column;\s*align-items:\s*flex-start;\s*gap:\s*8px;\s*\}/;
if (mobileFbRegex.test(content)) {
  content = content.replace(mobileFbRegex, `.footer-bottom {\n    flex-direction: column;\n    align-items: flex-start;\n    gap: 14px;\n  }`);
}

fs.writeFileSync(stylesPath, content, 'utf8');
console.log("Successfully updated styles.css footer!");
