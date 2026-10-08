import {
  LANDING_SUPPORT_EMAIL,
  SUPPORT_MAILTO,
} from "@/features/marketing/content";

/** Public marketing site pages linked from the footer. */
export const sitePages = {
  docs: {
    badge: "Documentation",
    title: "Novend Documentation",
    subtitle:
      "A practical guide to setting up your organization, selling on the counter, managing inventory and wholesale stock, syncing offline work, connecting hardware, and administering users, branches, and billing — on desktop, web, Android, and iOS (PWA).",
    sections: [
      {
        id: "getting-started",
        title: "Getting Started",
        detail: "Create your account, set up your business, and reach the dashboard ready to sell.",
        items: [
          "Open Sign up, enter your name, email, and password, and accept the Terms and Privacy Policy",
          "After signup, complete onboarding with your business name and optional contact details",
          "You land on the dashboard — your live overview of sales and activity",
          "Add your first branch, products, and activate a selling device from Settings when ready",
          "Invite cashiers and managers with the correct roles — never share owner credentials",
          "Run a test sale, print or preview a receipt, then verify the order and inventory movement",
          "Use Sign in next time, or get the desktop app, Android app, or iOS Home Screen PWA from Downloads",
        ],
      },
      {
        id: "sales",
        title: "Sales & Checkout",
        detail:
          "Fast, barcode-ready checkout with holds, discounts, payments, receipts, and returns.",
        items: [
          "Search or scan products into the cart; quantities and prices are locked in at sale time",
          "Apply discounts according to your store policy before taking payment",
          "Choose one payment method per sale (cash, card, or mobile money)",
          "Hold incomplete sales to free the counter, then resume without losing the cart",
          "Complete checkout to create one receipt and reduce inventory with a recorded reason",
          "Open Orders to review history, reprint receipts, or start a return",
          "Keep selling offline — queued sales sync when the network returns",
        ],
      },
      {
        id: "inventory",
        title: "Inventory & Catalog",
        detail:
          "Products, stock levels, valuation, and wholesale storage you can trust at the counter.",
        items: [
          "Track quantity, cost, and sell price per product — stock cannot go negative",
          "Import an existing catalog from CSV or Excel: Products → Import, download the template, map columns, preview, then import",
          "Opening stock on new products applies to the branch you choose; updates never silently rewrite on-hand quantity",
          "Keep wholesale / warehouse inventory separate from branch floor stock",
          "Use low-stock thresholds and archive products instead of deleting history",
          "Pharmacy workflows can use batch and expiry detail where enabled",
        ],
      },
      {
        id: "catalog-import",
        title: "Catalog Import",
        detail:
          "Bring an existing product list into Novend with a guided CSV or Excel wizard. Administrators and managers only.",
        items: [
          "Open Products and choose Import. Download the CSV template (Excel on Pro and above) so headers match Novend fields",
          "Required columns: Product Name, SKU, Category, Cost Price, and Selling Price. Optional: barcode, quantity, unit, minimum stock, description, status, and expiry fields",
          "Map each spreadsheet column to a Novend field. Saved mappings can be reused on the next file",
          "Preview creates vs updates. Opening stock applies on new products only, to the branch you select — existing SKUs are not restocked by import",
          "Your plan’s product limit still applies. Spreadsheet files are not stored; Novend keeps job counts, filenames, and your column mapping",
          "Cashiers cannot import. Cost prices in the file follow the same visibility rules as the rest of the catalog",
        ],
      },
      {
        id: "transfers",
        title: "Transfers & Adjustments",
        detail:
          "Move stock between warehouse and branches, and correct counts with a clear audit trail.",
        items: [
          "Issue warehouse stock to a branch when replenishing the floor",
          "Transfer between branches when one location needs what another has",
          "Adjust stock only with a business reason (damage, count correction, write-off)",
          "Review transfer and adjustment history when quantities look wrong",
        ],
      },
      {
        id: "offline",
        title: "Offline & Sync",
        detail:
          "Keep selling when the network drops, then reconcile automatically with the Novend cloud.",
        items: [
          "Sales and inventory updates save on the device first so the counter stays fast",
          "Pending changes upload when connectivity returns",
          "Watch sync status in the app — do not edit completed sales to “fix” sync",
          "Desktop and web use the same account and sync model — including the Android app and iOS Home Screen PWA",
        ],
      },
      {
        id: "hardware",
        title: "Hardware & Devices",
        detail: "Barcode scanners, cameras, thermal printers, and activated selling devices.",
        items: [
          "USB and camera barcode capture search the same product catalog",
          "Thermal receipt printing from the POS using your branch receipt template",
          "Activate desktop, Android, and iOS PWA devices within your plan’s device limit from Settings",
          "Prefer the desktop app for dedicated counters that need printers and barcode hardware",
        ],
      },
      {
        id: "customers",
        title: "Customers, Suppliers & Returns",
        detail:
          "Keep relationships and corrections connected to real sales — not spreadsheet side notes.",
        items: [
          "Attach customers to sales and review purchase history on their profile",
          "Maintain supplier contacts and delivery context alongside inventory",
          "Process returns against completed orders so stock and money stay consistent",
          "Completed sales stay immutable — corrections use return workflows",
        ],
      },
      {
        id: "analytics",
        title: "Analytics & Reports",
        detail:
          "See revenue, profit, and operational reports — then export CSV, Excel, or PDF when you need a file.",
        items: [
          "Monitor KPIs and trends from the analytics overview",
          "Review expenses and profit & loss views as your plan allows",
          "Export sales, inventory, and branch reports as CSV on every plan, plus Excel and PDF on Pro and above",
          "Use daily breakdowns when you need to drill into a specific day",
        ],
      },
      {
        id: "admin",
        title: "Users, Branches & Billing",
        detail: "Roles, branch setup, plan limits, upgrades, and organization controls.",
        items: [
          "Assign cashier, manager, and administrator roles from Users",
          "Open additional branches as you grow; stock and reports stay branch-aware",
          "Monitor plan capacity for products, users, and devices before hitting limits",
          "Upgrade without rebuilding your catalog — entitlements change, data stays",
          "Manage billing, receipts, and business profile from Settings",
        ],
      },
      {
        id: "security",
        title: "Security & Access",
        detail: "Protect accounts, staff access, and customer data in day-to-day operations.",
        items: [
          "Use strong unique passwords; do not share owner or admin logins across the floor",
          "Deactivate users who leave instead of reusing credentials",
          "Limit cashier permissions so pricing, inventory, and user admin stay protected",
          "Install updates from the official Download page and lock unattended devices",
        ],
      },
    ],
  },
  help: {
    badge: "Help Center",
    title: "How can we help you run Novend?",
    subtitle:
      "Troubleshooting and how-to answers for cashiers, managers, and owners — plus clear paths to documentation, downloads, and human support.",
    categories: [
      {
        title: "Selling on the counter",
        items: [
          {
            q: "A sale won’t complete offline",
            a: "Confirm the product has available stock and that the cart totals look correct, then retry. Novend writes the sale to the device first — internet is not required for checkout. If it still fails, check for a validation message (for example negative stock or missing payment) and try again after fixing it.",
          },
          {
            q: "The barcode scanner isn’t finding products",
            a: "Make sure the barcode or SKU on the shelf matches the catalog exactly. Camera scan and USB scanners search the same product list. If the product is archived or belongs to another branch’s assortment rules, it may not appear at this till.",
          },
          {
            q: "How do I reprint a receipt?",
            a: "Open Orders, select the completed sale, then use the receipt or print action. Completed sales are immutable — reprints use the saved snapshot of prices and quantities from checkout time.",
          },
          {
            q: "How do I hold and resume a sale?",
            a: "Use Hold when a customer steps away or you need the till for another sale. Resume from the held sales list. Inventory is not reduced until checkout completes.",
          },
          {
            q: "Can I edit a completed sale?",
            a: "No. Corrections use the returns workflow so inventory and history stay accurate. Process a return against the original order, then create a new sale if needed.",
          },
        ],
      },
      {
        title: "Stock & branches",
        items: [
          {
            q: "How do I import products from Excel or CSV?",
            a: "Administrators and managers open Products → Import. Download the Novend template, upload your file, map columns (name, SKU, category, cost, selling price are required), preview creates and updates, choose the branch for opening stock on new products, then import. Existing SKUs update catalog fields only — quantity on the spreadsheet does not rewrite on-hand stock. Excel import and the Excel template follow your plan; CSV import is available on commercial plans.",
          },
          {
            q: "Inventory looks wrong after a transfer",
            a: "Open the transfer history for that branch and confirm quantities issued and received. Stock never changes without a recorded reason. If a transfer was incomplete, finish or reverse it through supported inventory actions — do not adjust blindly without a reason code.",
          },
          {
            q: "How do I restock from wholesale?",
            a: "Use wholesale inventory to issue stock to a branch. Branch quantities update when the issue is recorded. Keep warehouse and branch stock separate so valuation stays clear.",
          },
          {
            q: "Can cashiers adjust stock?",
            a: "Stock adjustments and product edits are reserved for managers and administrators. Cashiers focus on sales, holds, receipts, and their own history. Ask an admin if a quantity needs correction.",
          },
          {
            q: "What happens when stock hits zero?",
            a: "Novend prevents inventory from going negative. You cannot complete a sale that would oversell unless stock is replenished or the quantity is reduced.",
          },
        ],
      },
      {
        title: "Devices, desktop & mobile",
        items: [
          {
            q: "Where do I download the desktop app?",
            a: "Open the Download page from the website menu. Installers for Windows, macOS, and Linux update automatically when we publish a new version. The same page has the Android app. iPhone and iPad use Novend as a Home Screen PWA from Safari.",
          },
          {
            q: "How do I add another device?",
            a: "Activate the device from Settings once your plan has available device capacity. Desktop, web, Android, and iOS PWA sessions may count toward your plan limit depending on entitlements.",
          },
          {
            q: "The printer isn’t printing",
            a: "Confirm the receipt printer is connected, selected in hardware settings, and that the desktop app (when used) has permission to access it. Reprint from the order if the sale already completed.",
          },
          {
            q: "How do I run Novend on a phone?",
            a: "Download the Android app from the Download page. On iPhone and iPad, open Novend in Safari, then Share → Add to Home Screen to install it as a PWA. Use the desktop app on a counter PC when you need printers and barcode hardware.",
          },
        ],
      },
      {
        title: "Account, plans & billing",
        items: [
          {
            q: "What happens when I upgrade?",
            a: "Your products, customers, branches, and sales stay intact. Higher plans unlock capacity and capabilities — they do not wipe business data.",
          },
          {
            q: "Who creates staff accounts?",
            a: "Organization administrators create employee accounts. Public signup is for business owners creating a new organization. Staff should sign in at https://dashboard.novendpos.app/login with credentials provided by their admin.",
          },
          {
            q: "I forgot my password",
            a: "Use the sign-in recovery options on https://dashboard.novendpos.app/login if available, or contact your organization administrator. Owners can reach Novend support for account recovery assistance.",
          },
          {
            q: "Who do I contact for Enterprise onboarding?",
            a: "Use Contact Sales from Pricing or email us with your branch count, SKUs, hardware needs, and go-live timeline so we can plan Enterprise setup with you.",
          },
        ],
      },
      {
        title: "Privacy, terms & data",
        items: [
          {
            q: "Where are the legal documents?",
            a: "Privacy Policy is at /privacy, Terms of Service at /terms, Refund & Cancellation at /refund, Cookie Policy at /cookies, Acceptable Use at /aup, and Data Processing Addendum at /dpa. You must accept Terms and Privacy before creating an account on signup.",
          },
          {
            q: "Do you sell my customer lists?",
            a: "No. Novend does not sell your business customer lists or inventory data. See the Privacy Policy for how operational and account data is processed.",
          },
          {
            q: "How do I request data export or account closure?",
            a: "Open Settings → Privacy & data in the app (web, PWA, Android, or iOS). Business owners can schedule business closure with a 30-day recovery window; other staff can delete their own account. You can also export catalogs, reports, and backups from Settings before closing. For complex data requests, contact support with your organization name and the owner account email.",
          },
        ],
      },
    ],
    supportCta: {
      title: "Still need help?",
      detail:
        "Reach the Novend team by email or WhatsApp. Include your organization name, branch, and a short description of what you were doing when the issue occurred.",
      email: LANDING_SUPPORT_EMAIL,
      mailto: SUPPORT_MAILTO,
      pageHref: "/contact",
      pageLabel: "Open contact page",
    },
  },
  releases: {
    badge: "Release Notes",
    title: "What’s new in Novend",
    subtitle:
      "Product improvements for desktop, Android, and the web app — written for business operators, not developers.",
    entries: [] as Array<{
      version: string;
      date: string;
      title: string;
      highlights: string[];
    }>,
  },
  privacy: {
    badge: "Legal",
    title: "Privacy Policy",
    effective: "Effective September 18, 2026",
    intro:
      "This Privacy Policy explains how Asiedu Development Hub (“we”, “us”, “our”) collects, uses, stores, shares, and protects information when you access Novend POS and related websites, the web application, desktop applications, the Android application, and the iOS Progressive Web App (together, the “Service”). Additional native applications we publish later remain covered. Please read it carefully. By creating an account or using Novend, you acknowledge this Policy.",
    sections: [
      {
        title: "1. Who we are and how to contact us",
        paragraphs: [
          "Novend is a commercial Point of Sale and business management platform operated by Asiedu Development Hub.",
          `Privacy questions, data access requests, and complaints can be sent to ${LANDING_SUPPORT_EMAIL}. You can also reach us on WhatsApp at +44 7868 178108 or by phone/WhatsApp at +233 55 525 7482.`,
          "If you use Novend on behalf of a business, that organization is typically the controller of its operational business records (products, sales, customers). We process that data to provide the Service under our agreement with the organization.",
        ],
      },
      {
        title: "2. Scope of this Policy",
        paragraphs: [
          "This Policy covers information processed through novendpos.com (and related domains), the Novend web application, desktop applications for Windows, macOS, and Linux, the Android application, and the iOS Progressive Web App (Home Screen install) that connect to the same Novend service.",
          "It does not cover third-party websites or services that we do not control, even if linked from Novend. Those services have their own privacy practices.",
        ],
      },
      {
        title: "3. Information we collect",
        paragraphs: [
          "Account and profile information: name, email address, phone number (if provided), organization name, role, and authentication credentials (passwords are stored using secure hashing via our auth provider — we do not store plaintext passwords).",
          "Business operational data you and your staff enter: products, categories, SKUs, barcodes, pricing, inventory quantities and movements, sales, receipts, returns, customers, suppliers, branches, users, expenses, analytics inputs, and related notes.",
          "Device and technical information: device activation identifiers, app or client version, operating system hints, whether you are using the web app, desktop app, Android app, or iOS PWA, sync status, approximate timestamps, and diagnostic logs needed to operate and secure the Service.",
          "Catalog import files you choose to upload (CSV or Excel) are processed so your organization can create or update products. We do not retain the original spreadsheet as a stored catalog file. Import summaries such as filename, row counts, and saved column mappings may be kept for support, plan administration, and to let you reuse mappings.",
          "Billing and commercial information: plan selection, subscription or lifetime licence status, invoices and payment references processed through our payment providers, and related support history.",
          "Communications: messages you send to support or sales, and feedback you provide about the product.",
          "We do not intentionally collect special categories of personal data beyond what you choose to store in your own business records (for example customer phone numbers). You are responsible for lawful collection of your customers’ data at the counter.",
        ],
      },
      {
        title: "4. How we use information",
        paragraphs: [
          "To provide, maintain, and improve offline-first POS, inventory, wholesale, catalog import, report and catalog export, sync, analytics, reporting, and support features.",
          "To authenticate users, enforce roles and organization isolation, apply plan limits, and protect accounts against unauthorized access.",
          "To process billing, trials, upgrades, and related customer communications.",
          "To diagnose outages, prevent abuse, and improve reliability and performance.",
          "To send important service notices (security, downtime, material policy or terms changes) and, where permitted, product updates relevant to your use of Novend.",
          "We do not sell your business customer lists, inventory data, or sales history to third parties for their marketing.",
        ],
      },
      {
        title: "5. Local-first storage, offline use, and cloud sync",
        paragraphs: [
          "Novend is designed so operational data can be stored on your device first, allowing sales to continue without internet connectivity after setup and activation.",
          "When connectivity is available, committed changes synchronize to Novend cloud services so you can access dashboards, backups, multi-device workflows, and organization-wide reports. Dashboards update from local data while you work and refresh after synchronization, depending on your connectivity and plan mode.",
          "Cloud connections use encrypted transport. Portable backups you export can be encrypted with a password you control. The active local operational store on a till or phone is not field-encrypted — it relies on device lock screens, browser or app profile isolation, and physical custody of the hardware.",
          "Treat POS devices as sensitive business equipment: enable Settings → Security → Inactivity lock on shared tills, use OS lock screens, control physical access, sign out when handing a device to another person, and deactivate lost devices through your administrator where possible.",
          "You remain responsible for the accuracy of business records you enter and for deciding which staff may access which branches and capabilities inside your organization.",
        ],
      },
      {
        title: "6. Sharing and processors",
        paragraphs: [
          "We share information with infrastructure, authentication, analytics (if enabled), and payment providers strictly as needed to operate Novend under appropriate agreements.",
          "Desktop and Android installers may be delivered through our secure download channels. The iOS client is currently a Progressive Web App you install from the browser; a native iOS application, if published later, is delivered the same way as other official packages. Version details and release notes may be stored in our systems so the Download page stays up to date.",
          "We may disclose information if required by applicable law, regulation, legal process, or to protect the rights, safety, and integrity of the Service, our users, or the public.",
          "Organization administrators control which staff can access business data inside their Novend workspace. We do not grant other Novend customers access to your organization data.",
          "If we engage in a merger, acquisition, or asset transfer, information may transfer as part of that transaction subject to continued confidentiality commitments where required.",
        ],
      },
      {
        title: "7. International processing",
        paragraphs: [
          "Novend may process and store information on servers and infrastructure in multiple regions, including cloud regions used by our providers.",
          "By using the Service you understand that your information may be transferred to and processed in countries that may have different data protection rules than your own. We take commercially reasonable steps to protect information in transit and at rest.",
        ],
      },
      {
        title: "8. Retention",
        paragraphs: [
          "We retain account and business data for as long as your organization uses Novend and as reasonably needed afterward for legitimate business, security, dispute resolution, backup, and legal compliance purposes.",
          "You may delete your staff account or, if you are the business owner, schedule organization closure from Settings → Privacy & data in the product. Owners have 30 days to undo closure before access is fully blocked. Administrators and managers can also export reports and catalogs (CSV on every plan; Excel and PDF according to plan entitlements). Some records may remain in backups or audit logs for a limited period after deletion requests, consistent with operational and legal needs.",
          "Completed sales and receipts are designed to remain immutable for integrity; corrections are handled through return and related workflows rather than silent edits.",
        ],
      },
      {
        title: "9. Security",
        paragraphs: [
          "We use administrative, technical, and organizational measures designed to protect information, including authentication, access control, transport encryption for network traffic to our services, and least-privilege practices for staff tools.",
          "Encryption in transit protects data between your client and Novend cloud services. Encrypted portable backups protect exported archives with a password. Local operational storage on the device is protected by device and browser security controls rather than application-level field encryption of every on-device record.",
          "No method of transmission or storage is perfectly secure. You should use strong passwords, enable inactivity locking on shared tills, limit admin access, keep clients updated from official download channels (including the Android app), and report suspected unauthorized access promptly.",
        ],
      },
      {
        title: "10. Your choices and rights",
        paragraphs: [
          "Organization owners and administrators can manage users, branches, products, and many operational records inside the app.",
          "Depending on applicable law, you may have rights to access, correct, delete, or restrict certain personal data, or to object to certain processing. Contact us to exercise these rights. We may need to verify your identity and role (for example, organization owner) before acting on requests that affect business data.",
          "You may unsubscribe from non-essential marketing emails where offered; service and billing notices may still be sent.",
        ],
      },
      {
        title: "11. Children",
        paragraphs: [
          "Novend is a business product and is not directed to children. We do not knowingly create accounts for individuals under 18 for the purpose of operating a Novend organization.",
        ],
      },
      {
        title: "12. Changes to this Policy",
        paragraphs: [
          "We may update this Privacy Policy as Novend evolves. Material changes will be reflected on this page with an updated effective date. Continued use of the Service after changes take effect constitutes acceptance of the updated Policy where permitted by law.",
          "Significant changes may also be communicated through the product or email when appropriate.",
        ],
      },
    ],
  },
  terms: {
    badge: "Legal",
    title: "Terms of Service",
    effective: "Effective September 18, 2026",
    intro:
      "These Terms of Service (“Terms”) form a binding agreement between you and Asiedu Development Hub governing access to and use of Novend POS, including the website, web application, desktop applications, Android application, iOS Progressive Web App, documentation, and related services (the “Service”). Additional native applications we publish later remain part of the Service. By creating an account, clicking to accept, or using Novend, you agree to these Terms.",
    sections: [
      {
        title: "1. Agreement and eligibility",
        paragraphs: [
          "You agree to these Terms on behalf of yourself and, if applicable, the business or organization you represent. You confirm you have authority to bind that organization.",
          "You must be legally able to enter a contract and must provide accurate registration information. If you do not agree, do not use the Service.",
          "Staff users invited by an organization must also follow these Terms and any internal policies set by their employer.",
        ],
      },
      {
        title: "2. The Service",
        paragraphs: [
          "Novend provides commercial Point of Sale, inventory, wholesale, analytics, reporting, multi-branch, offline-capable sync, and related business tools.",
          "Clients may include web browsers; desktop applications for Windows, macOS, and Linux; the Android application; and an iOS Progressive Web App installed from the browser. A native iOS application, if published, is covered by these Terms. Feature availability can vary by device and plan.",
          "We may modify, add, or remove features to improve the Service, address security, or reflect plan entitlements. We will not remove core paid capabilities without a commercially reasonable notice where practical.",
          "Beta or preview features may be unstable and are provided as-is.",
        ],
      },
      {
        title: "3. Accounts, organizations, and responsibilities",
        paragraphs: [
          "You are responsible for safeguarding login credentials and for activity under your organization’s account, including actions by cashiers and managers you invite.",
          "Administrators must assign roles appropriately. Cashiers must not be granted capabilities outside their role. Permissions are enforced by Novend; circumventing access controls is prohibited.",
          "You are responsible for the legality, accuracy, and tax treatment of products, prices, receipts, discounts, and business records you create in Novend.",
          "You must not use Novend to store or process data unlawfully, including unlawful customer data collection at the point of sale.",
          "Notify us promptly of suspected unauthorized access or credential compromise.",
        ],
      },
      {
        title: "4. Plans, trials, payment, and taxes",
        paragraphs: [
          "Paid plans are billed according to the pricing and billing interval shown at purchase or in an Enterprise agreement, including monthly, yearly, or lifetime options where available.",
          "Free trials, if offered, are time-limited and may require payment details depending on the checkout flow. When a trial ends, continued use of paid features may require an active subscription or licence.",
          "Fees for subscriptions, licences, and related paid services are governed by our Refund & Cancellation Policy at /refund. Except where that policy or applicable law requires otherwise, fees are non-refundable.",
          "You are responsible for applicable taxes. We may collect tax where legally required.",
          "Enterprise pricing, onboarding, and custom limits may be set in a separate order form or sales agreement, which prevails for those commercial terms if it conflicts with this summary.",
        ],
      },
      {
        title: "5. Acceptable use",
        paragraphs: [
          "Your use of Novend must comply with our Acceptable Use Policy at /aup, which is incorporated into these Terms. Prohibited conduct includes misuse, unauthorized access, unlawful activity, and providing Novend as a competing hosted service without written consent.",
          "We may suspend access that threatens the stability, security, or integrity of the Service or that violates the Acceptable Use Policy.",
        ],
      },
      {
        title: "6. Data, offline operation, and backups",
        paragraphs: [
          "Novend supports offline operation. You acknowledge that local device storage, timely sync, and device security are part of normal use.",
          "The Novend cloud is the authority for committed synchronized business state. On-device storage helps you keep selling offline, but it is not a substitute for proper device care and timely sync.",
          "We work to protect synchronized data with commercially reasonable measures, but you should maintain operational practices: control staff access, keep devices updated from official channels, and export or back up critical records according to your own compliance needs. In-app catalog import (CSV or Excel) and report export are tools your authorized staff operate; you remain responsible for the files you import and the records you export.",
          "Our Privacy Policy at /privacy describes how we process personal data and is incorporated by reference. Where we process personal data on your behalf as a processor, our Data Processing Addendum at /dpa applies.",
          "Our Cookie Policy at /cookies describes cookies and similar technologies used on our websites and marketing surfaces.",
        ],
      },
      {
        title: "7. Software downloads and updates",
        paragraphs: [
          "Desktop and Android installers made available on the Download page or in-product update channels are licensed for use with your valid Novend account and plan — not for redistribution. The iOS client is currently a Progressive Web App you add to the Home Screen from the browser; a native iOS package, if published, is licensed the same way as other official installers.",
          "You agree to install security and mandatory updates when prompted. Outdated clients may be restricted from connecting if they pose a risk.",
          "Release details and download links may be served through our cloud service. Availability of a specific platform build depends on whether that version has been published.",
        ],
      },
      {
        title: "8. Intellectual property",
        paragraphs: [
          "Novend, its branding, software, documentation, and related materials are owned by Asiedu Development Hub or its licensors and are protected by intellectual property laws.",
          "Your business content (catalog, sales, customers, and similar records) remains yours. You grant us a limited, worldwide licence to host, process, transmit, and display that content solely to provide and improve the Service.",
          "Feedback you provide may be used to improve Novend without obligation to you.",
        ],
      },
      {
        title: "9. Third-party services",
        paragraphs: [
          "The Service may integrate with third-party payment processors, hosting, authentication, or hardware. Their terms and privacy policies apply to their services.",
          "We are not responsible for third-party outages or hardware failures outside our reasonable control, though we will work in good faith to restore Novend-side functionality.",
        ],
      },
      {
        title: "10. Disclaimer of warranties",
        paragraphs: [
          "Except as expressly stated in these Terms or a separate written agreement, the Service is provided on a commercially reasonable “as is” and “as available” basis.",
          "To the fullest extent permitted by law, we disclaim implied warranties of merchantability, fitness for a particular purpose, and non-infringement.",
          "We do not warrant that the Service will be uninterrupted, error-free, or free of harmful components, or that offline devices will always sync without conflict requiring operator attention.",
        ],
      },
      {
        title: "11. Limitation of liability",
        paragraphs: [
          "To the fullest extent permitted by law, Asiedu Development Hub and its suppliers will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost revenue, lost data, or business interruption, arising from use of the Service.",
          "To the fullest extent permitted by law, our aggregate liability for claims relating to the Service will not exceed the amounts you paid us for the Service in the twelve (12) months before the claim (or, if none, one hundred US dollars or local equivalent).",
          "Some jurisdictions do not allow certain limitations; in those cases our liability is limited to the maximum extent permitted.",
        ],
      },
      {
        title: "12. Indemnity",
        paragraphs: [
          "You will defend and indemnify Asiedu Development Hub against claims arising from your business content, your violation of these Terms, or your unlawful use of the Service, including claims by your customers related to products you sell, except to the extent caused by our willful misconduct.",
        ],
      },
      {
        title: "13. Suspension and termination",
        paragraphs: [
          "You may stop using Novend at any time. Delete your staff account or schedule business closure from Settings → Privacy & data, or contact support for help.",
          "We may suspend or terminate access for breach of these Terms, non-payment, legal risk, or threat to the Service or other users.",
          "Upon termination, your right to access the Service ends. Provisions that by nature should survive (including intellectual property, disclaimers, limitations of liability, and indemnity) will survive.",
        ],
      },
      {
        title: "14. Governing law and disputes",
        paragraphs: [
          "These Terms are governed by the laws of Ghana, without regard to conflict-of-law rules, unless a mandatory consumer protection law in your jurisdiction requires otherwise.",
          "Courts located in Ghana will have exclusive jurisdiction over disputes arising from these Terms, subject to any non-waivable rights you may have.",
          "Before filing a formal claim, you agree to contact us and attempt good-faith resolution.",
        ],
      },
      {
        title: "15. Changes to these Terms",
        paragraphs: [
          "We may update these Terms from time to time. The effective date at the top of this page will change when we do. Material changes may also be announced in-product or by email.",
          "If you continue using the Service after updated Terms take effect, you accept the changes to the extent permitted by law. If you do not agree, stop using the Service and request account closure.",
        ],
      },
      {
        title: "16. Contact",
        paragraphs: [
          `For questions about these Terms, contact ${LANDING_SUPPORT_EMAIL}, WhatsApp +44 7868 178108, or phone/WhatsApp +233 55 525 7482.`,
          "Related policies: Privacy Policy (/privacy), Refund & Cancellation Policy (/refund), Cookie Policy (/cookies), Acceptable Use Policy (/aup), and Data Processing Addendum (/dpa).",
          "Asiedu Development Hub.",
        ],
      },
    ],
  },

  refund: {
    badge: "Legal",
    title: "Refund & Cancellation Policy",
    effective: "Effective September 18, 2026",
    intro:
      "This Refund & Cancellation Policy explains how subscriptions, licences, trials, and paid Novend services from Asiedu Development Hub may be cancelled and when refunds apply. It forms part of your agreement with us together with the Terms of Service.",
    sections: [
      {
        title: "1. Scope",
        paragraphs: [
          "This policy covers fees paid to Asiedu Development Hub for Novend POS plans (monthly, yearly, or lifetime where offered), paid upgrades, and related Novend SaaS charges processed through our official checkout or invoicing.",
          "It does not cover money you collect from your own retail or wholesale customers at the point of sale. Returns of goods you sell are your business responsibility and are handled inside Novend as sales returns, not as SaaS refunds.",
          "Payment processors (for example card or mobile-money gateways) may apply their own timelines for settling refunds once we approve them.",
        ],
      },
      {
        title: "2. General rule",
        paragraphs: [
          "Except where this policy or applicable law requires otherwise, all fees are non-refundable, including partial months, unused seats, unused device activations, and prepaid yearly or lifetime licence fees.",
          "Purchasing a plan, activating paid features after a trial, or renewing a subscription constitutes acceptance of this policy.",
        ],
      },
      {
        title: "3. Trials and evaluations",
        paragraphs: [
          "If we offer a free trial, you may cancel before the trial ends without charge for the paid plan that would otherwise start, provided you cancel through the billing settings or by contacting support in time for us to stop conversion.",
          "If payment is captured at trial end according to the checkout you accepted, that charge is treated as a normal paid subscription under this policy.",
        ],
      },
      {
        title: "4. How to cancel",
        paragraphs: [
          "You may cancel auto-renewal from Settings → Billing (or the equivalent billing screen) while signed in as an organization administrator, or by emailing support from an authorized address.",
          "Cancellation stops future renewals. You retain access to paid features until the end of the then-current paid period already charged, unless we terminate earlier for breach under the Terms.",
          "Closing or archiving an organization does not automatically create a refund for prepaid time.",
        ],
      },
      {
        title: "5. When we may refund",
        paragraphs: [
          "We may issue a full or partial refund, at our discretion or where required by law, in cases such as: duplicate charges for the same period; a clear billing error on our side; inability to deliver the core Service for a material continuous period attributable to us (not including your devices, local internet, or third-party gateways); or a statutory cooling-off or consumer right that applies to your purchase.",
          "Refund requests should be sent to support within fourteen (14) days of the charge, with your organization name, invoice or payment reference, and reason. We may request identity and payment verification.",
          "Approved refunds are returned to the original payment method where possible. Timing depends on the processor and your bank or wallet.",
        ],
      },
      {
        title: "6. What we do not refund",
        paragraphs: [
          "Change of mind after purchase; underuse of features or seats; staff mistakes; choosing the wrong plan; dissatisfaction with third-party hardware or printers; issues caused by unsupported or outdated clients you declined to update; or suspension for violation of the Terms or Acceptable Use Policy.",
          "Lifetime licences, once activated on an eligible organization, are generally not refundable after the limited review window in section 5, except where mandatory law says otherwise.",
        ],
      },
      {
        title: "7. Chargebacks",
        paragraphs: [
          "Please contact us before disputing a charge with your bank or wallet. Unwarranted chargebacks may result in suspension of the organization until the dispute is resolved, and we may share transaction records with the processor.",
        ],
      },
      {
        title: "8. Enterprise and custom agreements",
        paragraphs: [
          "If you signed a separate order form, enterprise agreement, or invoice terms, those commercial terms control for refunds and cancellation where they conflict with this policy.",
        ],
      },
      {
        title: "9. Changes",
        paragraphs: [
          "We may update this policy from time to time. The effective date above will change when we do. Material changes may also be announced in-product or by email. Continued paid use after the effective date constitutes acceptance where permitted by law.",
        ],
      },
      {
        title: "10. Contact",
        paragraphs: [
          `Refund and billing questions: ${LANDING_SUPPORT_EMAIL}. WhatsApp +44 7868 178108, or phone/WhatsApp +233 55 525 7482.`,
          "Asiedu Development Hub. Governing law aligns with the Terms of Service, subject to any non-waivable consumer rights.",
        ],
      },
    ],
  },

  cookies: {
    badge: "Legal",
    title: "Cookie Policy",
    effective: "Effective September 18, 2026",
    intro:
      "This Cookie Policy explains how Asiedu Development Hub uses cookies and similar technologies on Novend marketing sites and related web surfaces. It should be read with our Privacy Policy.",
    sections: [
      {
        title: "1. What we mean by cookies",
        paragraphs: [
          "Cookies are small text files stored on your device. Similar technologies include local storage, session storage, and pixels used for security, preferences, or measurement.",
          "The signed-in Novend application also uses local device storage to support offline POS operation. That operational storage is described in the Privacy Policy and is not limited to marketing cookies.",
        ],
      },
      {
        title: "2. Who this policy covers",
        paragraphs: [
          "This policy focuses on visitors to our public website, documentation, download, and legal pages. Staff using Novend inside an organization are also covered by the Privacy Policy and their employer’s instructions.",
        ],
      },
      {
        title: "3. Categories we use",
        paragraphs: [
          "Strictly necessary: authentication session cookies, security, load balancing, and fraud prevention required to run the site or Service.",
          "Preferences: remembering UI choices such as theme or dismissed notices where we offer them.",
          "Analytics and performance: understanding how public pages are used so we can improve reliability and content. We configure analytics to avoid collecting unnecessary personal detail where practical.",
          "We do not sell personal information collected via cookies as a business model.",
        ],
      },
      {
        title: "4. Third parties",
        paragraphs: [
          "Hosting, authentication, payment, and analytics providers may set their own cookies when you use their features. Their policies apply to those technologies.",
          "Embedded third-party content (if any) may set cookies we do not control.",
        ],
      },
      {
        title: "5. Your choices",
        paragraphs: [
          "On public Novend pages you can use the cookie banner (Accept all, Reject non-essential, or Customize) and reopen it anytime from Cookie settings in the site footer.",
          "You can also control cookies through your browser settings, including blocking or deleting cookies. Blocking strictly necessary cookies may prevent login or core site functions from working.",
          "Device-level advertising or tracking settings on mobile operating systems may also limit some measurement technologies.",
        ],
      },
      {
        title: "6. Retention",
        paragraphs: [
          "Session cookies typically expire when you close the browser. Persistent cookies remain until they expire or you delete them. Exact lifetimes depend on the cookie purpose and provider.",
        ],
      },
      {
        title: "7. Updates",
        paragraphs: [
          "We may update this Cookie Policy as our sites and vendors change. The effective date above will be revised when we do.",
        ],
      },
      {
        title: "8. Contact",
        paragraphs: [
          `Questions about cookies or privacy: ${LANDING_SUPPORT_EMAIL}.`,
          "See also Privacy Policy (/privacy) and Terms of Service (/terms).",
        ],
      },
    ],
  },

  aup: {
    badge: "Legal",
    title: "Acceptable Use Policy",
    effective: "Effective September 18, 2026",
    intro:
      "This Acceptable Use Policy (“AUP”) sets rules for using Novend. It is part of the Terms of Service between you and Asiedu Development Hub. Violations may result in suspension or termination.",
    sections: [
      {
        title: "1. Lawful use only",
        paragraphs: [
          "You may use Novend only for lawful business purposes. You must not use the Service to commit fraud, money laundering, sanctions evasion, IP theft, harassment, or any crime.",
          "You are responsible for complying with tax, consumer, employment, and sector rules that apply to your sales and staff.",
        ],
      },
      {
        title: "2. Security and access",
        paragraphs: [
          "Do not attempt to access another organization’s data, bypass authentication or role permissions, probe, scan, or stress-test systems without our prior written consent, or interfere with Service integrity.",
          "Do not share administrator credentials broadly; use invited staff accounts with least privilege. Report suspected breaches promptly.",
        ],
      },
      {
        title: "3. Content and customer data",
        paragraphs: [
          "Do not upload malware, illegal content, or content you do not have rights to process. Do not use Novend to store regulated data types the product is not designed for (for example, full payment card PAN/CVV storage) beyond what official payment integrations allow.",
          "Customer and staff personal data you enter remains your responsibility as a business. Follow applicable privacy law for your checkout and HR practices.",
        ],
      },
      {
        title: "4. Fair use and abuse",
        paragraphs: [
          "Do not reverse engineer proprietary parts of the Service except where mandatory law allows. Do not resell, white-label, or offer Novend as a competing multi-tenant service without written permission.",
          "Do not automate abusive bulk traffic, scrape non-public APIs, or use the Service in a way that degrades performance for others.",
        ],
      },
      {
        title: "5. Offline clients and updates",
        paragraphs: [
          "Keep official desktop and mobile clients reasonably up to date. We may block critically outdated clients that create security risk.",
          "Do not redistribute installers or license keys outside your organization.",
        ],
      },
      {
        title: "6. Enforcement",
        paragraphs: [
          "We may investigate suspected violations, remove or restrict content or access, and cooperate with law enforcement where legally required.",
          "We may suspend or terminate accounts for AUP or Terms breaches, with or without prior notice when risk is urgent.",
        ],
      },
      {
        title: "7. Reporting",
        paragraphs: [
          `Report abuse or security concerns to ${LANDING_SUPPORT_EMAIL} with details and, if possible, organization identifiers and timestamps.`,
        ],
      },
      {
        title: "8. Changes",
        paragraphs: [
          "We may update this AUP. Continued use after the new effective date constitutes acceptance where permitted by law.",
        ],
      },
    ],
  },

  dpa: {
    badge: "Legal",
    title: "Data Processing Addendum",
    effective: "Effective September 18, 2026",
    intro:
      "This Data Processing Addendum (“DPA”) applies when Asiedu Development Hub (“Processor”, “we”) processes personal data on behalf of a Novend customer organization (“Controller”, “you”) in providing the Novend Service. It supplements the Terms of Service and Privacy Policy.",
    sections: [
      {
        title: "1. Roles",
        paragraphs: [
          "You are the controller (or equivalent) of personal data you and your staff enter into Novend about your customers, employees, and business contacts.",
          "We act as processor (or equivalent) for that customer content when we host, sync, back up, and process it to provide the Service. We act as an independent controller for account administration data, billing, security logs, and product telemetry as described in the Privacy Policy.",
        ],
      },
      {
        title: "2. Subject matter and duration",
        paragraphs: [
          "Subject matter: cloud hosting and processing of POS, inventory, staff, customer, and related business records in Novend, including offline sync and support.",
          "Duration: for the term of your subscription or access, and for any retention period required for backups, legal holds, dispute resolution, or statutory obligations after closure.",
        ],
      },
      {
        title: "3. Nature and purpose of processing",
        paragraphs: [
          "We process personal data only to provide, secure, maintain, support, and improve the Service; to prevent abuse; and to comply with law — not for unrelated advertising profiles of your end customers.",
          "Processing includes storage, transmission, backup, indexing for search, and display to authorized users of your organization.",
        ],
      },
      {
        title: "4. Types of personal data and data subjects",
        paragraphs: [
          "Depending on how you configure and use Novend, data may include names, phone numbers, emails, role and branch assignments, device identifiers, sale and return records, and similar business operations data about staff, customers, and suppliers.",
          "You must not instruct us to process special-category or highly regulated data unless Novend expressly supports that use and you have a lawful basis.",
        ],
      },
      {
        title: "5. Controller instructions",
        paragraphs: [
          "We process customer content according to your documented instructions: use of the product features, configuration, exports/imports you initiate, and written instructions consistent with the Terms.",
          "If an instruction appears unlawful, we will inform you unless law prohibits that notice.",
        ],
      },
      {
        title: "6. Confidentiality and security",
        paragraphs: [
          "We require personnel with access to customer content to maintain confidentiality and limit access on a need-to-know basis.",
          "We implement commercially reasonable technical and organizational measures appropriate to the risk, including access controls, encryption in transit for cloud connections, and monitoring for abuse. No method of transmission or storage is perfectly secure.",
        ],
      },
      {
        title: "7. Subprocessors",
        paragraphs: [
          "You authorize us to engage subprocessors reasonably needed to operate Novend (for example cloud hosting, authentication, email delivery, error monitoring, and payment processing).",
          "We remain responsible for subprocessors’ performance insofar as they process customer content for us. We will impose data-protection terms no less protective than this DPA in material respects.",
          "A current high-level list of infrastructure categories is available on request at the contact below. We will provide reasonable notice of material subprocessor changes where required by applicable law or contract.",
        ],
      },
      {
        title: "8. International transfers",
        paragraphs: [
          "Customer content may be processed in countries where we or our subprocessors operate. Where required, we use appropriate transfer mechanisms or contractual safeguards.",
        ],
      },
      {
        title: "9. Assistance with rights and assessments",
        paragraphs: [
          "Taking into account the nature of processing, we will provide reasonable assistance so you can respond to data-subject requests, security incidents affecting customer content, and documented DPIA/risk assessments you are legally required to perform — via product features (export, user deactivation, organization closure) and support.",
          "You are responsible for verifying the identity of requesters who contact you about your customers.",
        ],
      },
      {
        title: "10. Breach notification",
        paragraphs: [
          "If we become aware of a personal-data breach affecting your customer content in our systems, we will notify you without undue delay and provide information reasonably available to help you meet your own notification duties.",
        ],
      },
      {
        title: "11. Return and deletion",
        paragraphs: [
          "During the subscription you may export many records through product features. After organization closure or termination, we delete or de-identify customer content from active systems within a commercially reasonable period, except copies retained in encrypted backups for a limited rolling window or where law requires retention.",
          "Certified deletion timelines may vary by storage layer; contact support for status after closure.",
        ],
      },
      {
        title: "12. Audits",
        paragraphs: [
          "Upon reasonable written request no more than once per year (unless a supervisory authority or confirmed incident requires more), we will provide information reasonably necessary to demonstrate compliance with this DPA, such as security summaries. On-site audits require mutual agreement on scope, timing, confidentiality, and cost.",
        ],
      },
      {
        title: "13. Liability and order of precedence",
        paragraphs: [
          "Liability under this DPA is subject to the limitations in the Terms of Service unless mandatory law provides otherwise.",
          "If this DPA conflicts with the Terms on data-processing topics, this DPA controls for those topics. Enterprise DPAs or SCCs signed separately control where they conflict with this online DPA.",
        ],
      },
      {
        title: "14. Contact",
        paragraphs: [
          `Privacy and DPA contact: ${LANDING_SUPPORT_EMAIL}.`,
          "Asiedu Development Hub.",
        ],
      },
    ],
  },
} as const;
