import { GENERAL_SALES_MAILTO, LANDING_CONTACT_EMAIL } from "@/features/marketing/content";

/** Public marketing site pages linked from the footer. */
export const sitePages = {
  docs: {
    badge: "Documentation",
    title: "Novend Documentation",
    subtitle:
      "Everything you need to set up, sell, manage inventory, and keep your business synchronized — on desktop, web, and offline.",
    sections: [
      {
        id: "getting-started",
        title: "Getting Started",
        detail: "Create your organization, invite your team, and complete your first sale.",
        items: [
          "Sign up and choose a plan that fits your store",
          "Add your first branch and activate a device",
          "Import or create products with SKUs and barcodes",
          "Complete a sale and print a receipt",
        ],
      },
      {
        id: "sales",
        title: "Sales & Checkout",
        detail: "Barcode scanning, holds, payments, receipts, and returns.",
        items: [
          "Scan or search products into the cart",
          "Apply discounts and split payments",
          "Hold and resume incomplete sales",
          "Process returns against completed orders",
        ],
      },
      {
        id: "inventory",
        title: "Inventory & Wholesale",
        detail: "Stock levels, adjustments, wholesale storage, and branch transfers.",
        items: [
          "Track quantity, cost, and sell price per product",
          "Receive supplier stock and adjust inventory with history",
          "Keep wholesale inventory separate from branch stock",
          "Transfer stock between branches with a clear audit trail",
        ],
      },
      {
        id: "offline",
        title: "Offline & Sync",
        detail: "Keep selling when the network drops, then sync automatically.",
        items: [
          "Sales and inventory updates save on the device first",
          "Pending changes upload when connectivity returns",
          "Cloud backup protects committed business data",
          "Multi-branch operations stay isolated per location",
        ],
      },
      {
        id: "hardware",
        title: "Hardware",
        detail: "Barcode scanners, cameras, and thermal receipt printers.",
        items: [
          "USB and camera barcode capture",
          "Thermal receipt printing from the POS",
          "Desktop-ready workflows for Windows, macOS, and Linux",
          "Web and tablet checkout for flexible counters",
        ],
      },
      {
        id: "admin",
        title: "Users, Branches & Billing",
        detail: "Roles, branch setup, plan limits, and upgrades.",
        items: [
          "Assign cashier, manager, and administrator roles",
          "Open additional branches as you grow",
          "Monitor plan capacity for products, users, and devices",
          "Upgrade anytime without rebuilding your catalog",
        ],
      },
    ],
  },
  help: {
    badge: "Help Center",
    title: "How can we help you run Novend?",
    subtitle:
      "Quick answers for cashiers, managers, and owners — plus clear paths to contact support when you need a person.",
    categories: [
      {
        title: "Selling on the counter",
        items: [
          {
            q: "A sale won’t complete offline",
            a: "Confirm the product has stock available, then retry. Novend writes the sale to the device first — internet is not required for checkout.",
          },
          {
            q: "The barcode scanner isn’t finding products",
            a: "Check that the SKU or barcode on the product matches the catalog. Camera scan and USB scanners both search the same product list.",
          },
          {
            q: "How do I reprint a receipt?",
            a: "Open the order from Orders, then use the receipt / print action. Completed sales stay immutable; reprints use the saved snapshot.",
          },
        ],
      },
      {
        title: "Stock & branches",
        items: [
          {
            q: "Inventory looks wrong after a transfer",
            a: "Open the transfer history for that branch and confirm quantities issued. Stock never changes without a recorded reason in Novend.",
          },
          {
            q: "How do I restock from wholesale?",
            a: "Use wholesale inventory to issue stock to a branch. Branch quantities update when the issue is recorded — not before.",
          },
          {
            q: "Can cashiers adjust stock?",
            a: "Stock adjustments and product edits are reserved for managers and administrators. Cashiers focus on sales, holds, receipts, and their own history.",
          },
        ],
      },
      {
        title: "Account & plans",
        items: [
          {
            q: "What happens when I upgrade?",
            a: "Your products, customers, branches, and sales stay intact. Higher plans unlock capacity and capabilities — they do not wipe your business data.",
          },
          {
            q: "How do I add another device?",
            a: "Activate the device from Settings once your plan has available device capacity. Desktop and web sessions count toward your plan limit.",
          },
          {
            q: "Who do I contact for Enterprise onboarding?",
            a: "Use Contact Sales from Pricing or email us with your branch count, SKUs, and go-live timeline so we can plan Enterprise setup with you.",
          },
        ],
      },
    ],
    supportCta: {
      title: "Still need help?",
      detail: "Reach the Novend team by email, WhatsApp, or local Ghana support.",
      email: LANDING_CONTACT_EMAIL,
      mailto: GENERAL_SALES_MAILTO,
    },
  },
  releases: {
    badge: "Release Notes",
    title: "What’s new in Novend",
    subtitle:
      "Product updates across offline POS, inventory, sync, desktop, and commercial plans — written for business operators, not just engineers.",
    entries: [
      {
        version: "1.0.0",
        date: "August 2026",
        title: "Commercial foundation",
        highlights: [
          "Offline-first checkout with local save and cloud sync",
          "Inventory, wholesale, and branch transfer workflows",
          "Basic, Pro, Enterprise, and Lifetime plans",
          "Desktop, web, and barcode-ready selling",
          "Analytics, reports, customers, suppliers, and returns",
        ],
      },
    ],
  },
  privacy: {
    badge: "Legal",
    title: "Privacy Policy",
    effective: "Effective August 22, 2026",
    intro:
      "This Privacy Policy explains how Asiedu Development Hub (“we”, “us”) collects, uses, and protects information when you use Novend POS (the “Service”).",
    sections: [
      {
        title: "1. Who we are",
        paragraphs: [
          "Novend is a commercial Point of Sale and business management platform operated by Asiedu Development Hub, based in Sunyani, Bono Region, Ghana.",
          `Questions about privacy can be sent to ${LANDING_CONTACT_EMAIL}.`,
        ],
      },
      {
        title: "2. Information we collect",
        paragraphs: [
          "Account information such as name, email, phone, organization name, and role.",
          "Business operational data you enter into Novend, including products, inventory, sales, customers, suppliers, branches, users, receipts, and reports.",
          "Technical information needed to run the Service, such as device activation details, app version, and sync status.",
          "Billing and plan information related to subscriptions or lifetime licences.",
        ],
      },
      {
        title: "3. How we use information",
        paragraphs: [
          "To provide offline-first POS, inventory, sync, analytics, and support features you request.",
          "To authenticate users, enforce roles and plan limits, and protect account security.",
          "To improve reliability, diagnose issues, and communicate important product or billing updates.",
          "We do not sell your business customer lists or inventory data.",
        ],
      },
      {
        title: "4. Local-first storage and cloud sync",
        paragraphs: [
          "Novend is designed so operational data can be stored on your device first, allowing sales to continue without internet.",
          "When connectivity is available, committed changes synchronize to Novend cloud services so you can access dashboards, backups, and multi-device workflows.",
          "You remain responsible for the accuracy of business records you enter and for controlling who has access inside your organization.",
        ],
      },
      {
        title: "5. Sharing",
        paragraphs: [
          "We may share information with infrastructure and payment providers strictly as needed to operate Novend.",
          "We may disclose information if required by law or to protect the rights, safety, and integrity of the Service and our users.",
          "Organization administrators control which staff can access business data inside their Novend workspace.",
        ],
      },
      {
        title: "6. Retention",
        paragraphs: [
          "We retain account and business data for as long as your organization uses Novend and as needed for legitimate business, legal, or security purposes.",
          "You may request account closure or data export assistance by contacting support.",
        ],
      },
      {
        title: "7. Your choices",
        paragraphs: [
          "Organization owners and administrators can manage users, branches, and operational records inside the app.",
          "You may contact us to update account details, ask privacy questions, or request support regarding data access.",
        ],
      },
      {
        title: "8. Changes",
        paragraphs: [
          "We may update this Privacy Policy as Novend evolves. Material changes will be reflected on this page with an updated effective date.",
        ],
      },
    ],
  },
  terms: {
    badge: "Legal",
    title: "Terms of Service",
    effective: "Effective August 22, 2026",
    intro:
      "These Terms of Service (“Terms”) govern your access to and use of Novend POS provided by Asiedu Development Hub.",
    sections: [
      {
        title: "1. Agreement",
        paragraphs: [
          "By creating an account or using Novend, you agree to these Terms on behalf of yourself and the organization you represent.",
          "If you do not agree, do not use the Service.",
        ],
      },
      {
        title: "2. The Service",
        paragraphs: [
          "Novend provides commercial Point of Sale, inventory, wholesale, analytics, reporting, and related business tools across web and desktop clients.",
          "Features available to you depend on your selected plan and entitlements (Basic, Pro, Enterprise, Lifetime, or trial).",
        ],
      },
      {
        title: "3. Accounts and responsibilities",
        paragraphs: [
          "You are responsible for safeguarding login credentials and for activity under your organization’s account.",
          "Administrators must assign roles appropriately. Cashiers must not be granted capabilities outside their role.",
          "You are responsible for the legality and accuracy of products, prices, receipts, tax treatment, and business records you create in Novend.",
        ],
      },
      {
        title: "4. Plans, trials, and payment",
        paragraphs: [
          "Paid plans are billed according to the pricing shown at purchase, including monthly, yearly, or lifetime options where available.",
          "Free trials, if offered, are time-limited and may convert to a paid plan based on the checkout flow you complete.",
          "Enterprise pricing and onboarding may be customized through sales.",
        ],
      },
      {
        title: "5. Acceptable use",
        paragraphs: [
          "You may not misuse Novend, attempt unauthorized access, interfere with other customers, or use the Service for unlawful activity.",
          "You may not reverse engineer proprietary parts of the Service except where permitted by applicable law.",
        ],
      },
      {
        title: "6. Data and offline operation",
        paragraphs: [
          "Novend supports offline operation. You acknowledge that local device storage and timely sync are part of normal use.",
          "We work to protect synchronized data, but you should maintain appropriate operational practices, including controlling staff access and keeping devices secure.",
        ],
      },
      {
        title: "7. Intellectual property",
        paragraphs: [
          "Novend, its branding, software, and documentation are owned by Asiedu Development Hub or its licensors.",
          "Your business content remains yours. You grant us a limited licence to host and process that content solely to provide the Service.",
        ],
      },
      {
        title: "8. Disclaimer and limitation",
        paragraphs: [
          "Novend is provided on a commercially reasonable basis. To the fullest extent permitted by law, we disclaim warranties not expressly stated in these Terms.",
          "To the fullest extent permitted by law, Asiedu Development Hub is not liable for indirect, incidental, or consequential damages arising from use of the Service.",
        ],
      },
      {
        title: "9. Termination",
        paragraphs: [
          "You may stop using Novend at any time. We may suspend or terminate access for breach of these Terms, non-payment, or risk to the Service.",
          "Provisions that by nature should survive termination will survive, including intellectual property, disclaimers, and limitations of liability.",
        ],
      },
      {
        title: "10. Contact",
        paragraphs: [
          `For questions about these Terms, contact ${LANDING_CONTACT_EMAIL}, WhatsApp/calls +44 7868 178108, or local support +233 55 525 7482.`,
          "Asiedu Development Hub — Sunyani, Bono Region, Ghana.",
        ],
      },
    ],
  },
} as const;
