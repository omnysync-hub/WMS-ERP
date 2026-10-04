import fs from 'fs';

const appJsxPath = 'd:/METAL ENGR WEBSITE/src/App.jsx';
let content = fs.readFileSync(appJsxPath, 'utf8');

// Locate Footer function
const footerRegex = /function Footer\(\) \{[\s\S]*?^}/m;

const newFooterCode = `function LinkedInIcon({ size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.79v8.37H6.46v-8.37M7.86 6.32a1.62 1.62 0 0 0-1.63 1.62c0 .9.73 1.63 1.63 1.63.9 0 1.63-.73 1.63-1.63 0-.9-.73-1.62-1.63-1.62Z" />
    </svg>
  );
}

function FacebookIcon({ size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95C18.05 21.45 22 17.19 22 12Z" />
    </svg>
  );
}

function Footer() {
  return (
    <>
      <footer className="site-footer">
        <div className="footer-top">
          <div className="footer-brand-wrap">
            <Logo />
          </div>
          <p className="footer-tagline">
            Precision-built solutions for the environments that keep industry moving.
          </p>
          <div className="footer-actions">
            <div className="footer-socials" aria-label="Social media channels">
              <a
                href="https://www.linkedin.com/in/the-metal-engineering-7a6a0143b"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon-btn"
                aria-label="Metal Engineering on LinkedIn"
                title="LinkedIn"
              >
                <LinkedInIcon size={20} />
              </a>
              <a
                href="https://web.facebook.com/profile.php?id=61594782787657&sk=about"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon-btn"
                aria-label="Metal Engineering on Facebook"
                title="Facebook"
              >
                <FacebookIcon size={20} />
              </a>
            </div>
            <ArrowLink href="#contact">Talk to our team</ArrowLink>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} Metal Engineering</span>
          <span className="footer-specs">Fabrication &bull; Automation &bull; Site Solutions</span>
          <a href="#contact" className="footer-location">Lahore, Pakistan</a>
          <span className="footer-credit">
            Powered by{' '}
            <a
              href="https://omnysync.com"
              target="_blank"
              rel="noopener noreferrer"
              className="omnysync-link"
              title="OMNYSYNC - Technology & Digital Systems"
            >
              OMNYSYNC
            </a>
          </span>
        </div>
      </footer>
      <BackToTop />
    </>
  );
}`;

if (!footerRegex.test(content)) {
  console.error("Footer regex did not match!");
  process.exit(1);
}

content = content.replace(footerRegex, newFooterCode);
fs.writeFileSync(appJsxPath, content, 'utf8');
console.log("Successfully updated App.jsx Footer!");
