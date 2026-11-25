# Research: the best email service for shrujan.dev

Ticket: #57. Researched 2026-11-26. All prices are in USD, taken from the pricing pages on that date, and can change.
Legend: **[doc]** means a provider's own page states it. **[inf]** means I inferred it from documented facts, or the source does not settle it.

## The question

Which service is best for an @shrujan.dev address, and what does each option need? The address is for one person with one or two addresses. The founder's current mailbox stays in use. shrujan.dev is registered at Porkbun and uses Porkbun nameservers. The site goes on GitHub Pages at the apex, so MX and TXT records must sit alongside the Pages A/AAAA records.

## Headline finding: Gmail "Send mail as" ends in January 2027

The usual cheap setup is a free forwarder plus Gmail's "Send mail as". It stops working within weeks.

- Google: "Starting January 2027, Gmail will no longer support the 'Send as' feature for third-party email addresses." Existing setups work until then. Gmail "may restrict new configurations" during the Q3 to Q4 2026 transition, which is now. Google Workspace aliases are not affected. **[doc]** [support.google.com/mail/answer/22370](https://support.google.com/mail/answer/22370), [support.google.com/mail/answer/17101213](https://support.google.com/mail/answer/17101213)
- Gmailify and POP fetching from other accounts are removed on the same date. **[doc]** (same page)
- ImprovMX's own guide repeats the date. It also says Gmail send-as through smtp.gmail.com "lacks proper email authentication", meaning no DKIM for your domain, so mail can land in spam. **[doc]** [improvmx.com/guides/send-emails-using-gmail](https://improvmx.com/guides/send-emails-using-gmail/)
- Google's page does not say outright whether "you@shrujan.dev sent through a third-party SMTP server" counts as a "third-party address". **[inf]** It almost certainly does, because Google exempts only Google-hosted identities.

**What this means:** after January 2027 there are two ways to send as @shrujan.dev from Gmail's own interface. One is to make the domain Google-hosted with Workspace. The other is a paid mailbox used in its own app or webmail, or in a desktop IMAP/SMTP client. Every forwarder in this list becomes **receive-only** as far as Gmail is concerned. Their SMTP can still be used from a desktop mail client such as Apple Mail or Thunderbird.

## Comparison

| Service | Sending as @shrujan.dev | Cost for 1 person | DNS stays at Porkbun? | Catch-all | Aliases |
|---|---|---|---|---|---|
| Porkbun forwarding | Receive only. Replies go out from your personal address **[doc]** | Free **[doc]** | Yes (native) | **No** **[doc]** | 20 forwards per domain **[doc]** |
| Porkbun Email (hosted) | Yes: webmail, IMAP/POP/SMTP **[doc]** | From $3.00/mo, 15-day trial **[doc]** | Yes (native) | Not documented | 1 mailbox, plus 1 + 20 forwards **[doc]** |
| Cloudflare Email Routing | Routing is receive only. Email Sending (beta) gives SMTP; on Workers Free it sends only to verified addresses **[doc]** | Routing free. Sending to anyone needs Workers Paid (3,000 msgs/mo included, then $0.35 per 1k) **[doc]**; Workers Paid is about $5/mo **[inf]** | **No. Must move nameservers to Cloudflare** **[doc]** | Yes **[doc]** | 200 rules per domain **[doc]** |
| ImprovMX | Free: receive only. Paid: SMTP **[doc]** | Free. SMTP from Light at $50/yr (750 sends/mo) or Premium at $9/mo **[doc]** | Yes | Yes, created by default **[doc]** | 25 (Free and Light) **[doc]** |
| Fastmail | Yes, full mailbox **[doc]** | Individual: $5/mo billed yearly ($60/yr), $6 month to month, 30-day trial **[doc]** | Yes (MX-only setup) **[doc]** | Yes (`*@domain`); can also send from any address **[doc]** | Many ("hundreds"; no exact limit published) **[doc]** |
| Google Workspace | Yes, inside the Gmail interface (separate account) **[doc]** | Starter $7/user/mo on the annual plan. Intro price $3.50 for 12 months **[doc]** | Yes **[doc]** | Not on the alias page **[doc]**; available through admin routing rules **[inf]** | 30 per user, free **[doc]** |
| Proton Mail | Yes, Mail Plus or higher **[doc]** | Mail Plus: $29.88 first year, then $47.88/yr. Unlimited: $77.88, then $119.88 **[doc]** | Yes (Porkbun guide) **[doc]** | Yes, any paid plan **[doc]** | 10 addresses, 1 custom domain (Plus) **[doc]** |
| Zoho Mail | Free: web and app only, no IMAP/POP **[doc]**. Paid: full | Forever Free $0 (5 GB). Mail Lite from $1/user/mo, billed yearly **[doc]** | Yes **[doc]** | Yes. Plan coverage unclear **[doc]**/**[inf]** | Supported, plan limits not shown **[doc]** |

## Each option in detail

### Porkbun email forwarding
- Up to 20 free forwards per domain. "Wildcard or catchall email forwarding addresses are not supported." Replies "will show as having been sent from your personal email address." **[doc]** [kb.porkbun.com/article/10](https://kb.porkbun.com/article/10-how-to-set-up-email-forwarding-service), [porkbun.com/products/email](https://porkbun.com/products/email)
- DNS: MX `fwd1.porkbun.com` (10) and `fwd2.porkbun.com` (20), plus TXT `v=spf1 include:_spf.porkbun.com ~all`. Porkbun's "Fix DNS" button adds them while DNS is at Porkbun. Moving to third-party nameservers breaks Porkbun forwarding and hosting unless the records are copied across. **[doc]** [kb.porkbun.com/article/47](https://kb.porkbun.com/article/47-how-to-use-porkbun-email-when-your-dns-is-hosted-elsewhere), [kb.porkbun.com/article/222](https://kb.porkbun.com/article/222-how-to-fix-your-porkbun-mx-records)
- Deliverability: no sending, so not applicable. Lock-in: none; nothing is stored. **[inf]**

### Porkbun Email (hosted)
- From $3.00/mo, 10 GB, webmail plus POP3/IMAP. The page lists "Send & Receive Email". **[doc]** [porkbun.com/products/email](https://porkbun.com/products/email)
- Servers: `imap.porkbun.com:993` and `smtp.porkbun.com:587/465`. **[doc]** [kb.porkbun.com/article/146](https://kb.porkbun.com/article/146-email-client-configuration-settings)
- DNS: the same MX and SPF records as forwarding, plus DKIM TXT `default._domainkey` and DMARC TXT `_dmarc` (values shown in the Porkbun panel). **[doc]** [kb.porkbun.com/article/47](https://kb.porkbun.com/article/47-how-to-use-porkbun-email-when-your-dns-is-hosted-elsewhere)
- Not documented: catch-all, the backend provider, an export tool. IMAP allows a standard export. **[inf]** Porkbun publishes no sending-reputation track record **[inf]**; it is the least proven sender here.
- Porkbun also resells Proton Mail, "From $5.99/month". **[doc]** Buying Proton direct is cheaper; see below.

### Cloudflare Email Routing (and Email Sending)
- Routing is free and unlimited, with catch-all and plus-addressing. 200 rules per domain, 200 destination addresses, 25 MiB message limit. **[doc]** [developers.cloudflare.com/email-routing/setup/email-routing-addresses](https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/), [/email-routing/limits](https://developers.cloudflare.com/email-routing/limits/)
- "You must be using Cloudflare DNS to use Email Service." Onboarding adds MX, SPF TXT and DKIM TXT records at the apex. **[doc]** [enable-email-routing](https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/) The CNAME (partial) setup that keeps nameservers elsewhere is limited to Business and Enterprise plans. **[doc]** [dns/zone-setups/partial-setup](https://developers.cloudflare.com/dns/zone-setups/partial-setup/) **So in practice this means moving shrujan.dev's nameservers to Cloudflare.** **[inf]**
- Sending: Email Sending is in public beta (since April 2026). Authenticated SMTP submission went into beta on 2026-06-08 at `smtp.mx.cloudflare.net:465`, with the username `api_token` and a Cloudflare API token as the password. On Workers Free it sends only to verified destination addresses. Sending to anyone needs Workers Paid: 3,000 messages a month included, then $0.35 per 1,000. **[doc]** [email-service/platform/pricing](https://developers.cloudflare.com/email-service/platform/pricing/), [SMTP changelog](https://developers.cloudflare.com/changelog/post/2026-06-08-smtp-submission/), [email-service/api/send-emails/smtp](https://developers.cloudflare.com/email-service/api/send-emails/smtp/) It is aimed at apps and transactional mail rather than personal mail. **[doc]**/**[inf]**
- Using it with GitHub Pages: the Pages A/AAAA records at the apex should be set to "DNS only" (grey cloud). Proxying them interferes with Pages' TLS certificate. **[inf]**
- Lock-in: low. Cloudflare keeps no mailbox, and the domain stays registered at Porkbun. **[inf]**

### ImprovMX
- Free: 1 domain, 25 aliases, 500 forwards a day, no SMTP. Light: $50/yr, 5 domains, 750 SMTP sends a month. Premium: $9/mo, 12,000 sends a month. 15% off when billed yearly. **[doc]** [improvmx.com/pricing](https://improvmx.com/pricing)
- A catch-all (`*`) alias is created by default when you add a domain. **[doc]** [guides/catchall-wildcard-aliases](https://improvmx.com/guides/catchall-wildcard-aliases/) The guide does not name a plan, so it presumably works on Free. **[inf]**
- DNS at Porkbun: MX `mx1.improvmx.com` (10) and `mx2.improvmx.com` (20), plus TXT `v=spf1 include:spf.improvmx.com ~all`. DKIM is added for paid SMTP. **[doc]** [guides/porkbun](https://improvmx.com/guides/porkbun), [guides/adding-dkim-records](https://improvmx.com/guides/adding-dkim-records/)
- Sending: ImprovMX SMTP has proper SPF and DKIM. Gmail send-as through smtp.gmail.com lacks them and ends in January 2027. **[doc]**

### Fastmail
- Individual: $6/mo month to month, $5/mo billed yearly ($60), $4.75/mo for 24 months ($114). 60 GB, custom domains, 30-day trial. Basic ($3/mo yearly) **does not support custom domains**. **[doc]** [fastmail.com/pricing](https://www.fastmail.com/pricing/)
- MX-only DNS, which keeps nameservers at Porkbun **[doc]** ([help article](https://www.fastmail.help/hc/en-us/articles/1500000280261-Setting-up-your-domain-MX-only)):
  - MX `in1-smtp.messagingengine.com` (10), `in2-smtp.messagingengine.com` (20)
  - TXT `v=spf1 include:spf.messagingengine.com ?all`
  - CNAME `fm1._domainkey` → `fm1.shrujan.dev.dkim.fmhosted.com` (also fm2 and fm3)
  - TXT `_dmarc` `v=DMARC1; p=none;`
  - Optional wildcard MX on `*.shrujan.dev` for subdomain addressing **[doc]** ([manual DNS](https://www.fastmail.help/hc/en-us/articles/360060591153-Manual-DNS-configuration))
- Catch-all is `*@shrujan.dev`. It can also send from any address. **[doc]** [Catch-all/wildcard aliases](https://www.fastmail.help/hc/en-us/articles/1500000277942-Catch-all-wildcard-aliases)
- Lock-in: low. It uses standard IMAP/SMTP/JMAP. **[inf]** Fastmail runs its own sending infrastructure and is well regarded for deliverability. **[inf]** No first-party deliverability statistics are published.

### Google Workspace
- Starter: $7/user/mo on the annual plan, 30 GB, 14-day trial. Intro price $3.50/mo for 12 months for new customers. **[doc]** [workspace.google.com/pricing](https://workspace.google.com/pricing) The page shows only the annual-commitment price; the flexible (monthly) rate was not captured. **[doc]**
- DNS: MX `smtp.google.com` (priority 1), TXT `v=spf1 include:_spf.google.com ~all`, DKIM TXT `google._domainkey` (available 24 to 72 hours after setup), and DMARC once SPF and DKIM have passed for 48 hours. Works with third-party DNS. **[doc]** [MX](https://knowledge.workspace.google.com/admin/domains/set-up-mx-records-for-google-workspace), [SPF](https://knowledge.workspace.google.com/admin/security/set-up-spf), [DKIM](https://knowledge.workspace.google.com/admin/security/set-up-dkim)
- 30 aliases per user, free. **[doc]** [alias help](https://knowledge.workspace.google.com/admin/users/add-or-delete-an-alternate-email-address-email-alias)
- It is a **separate Google account**, not your existing Gmail. **[inf]** Workspace aliases are exempt from the send-as removal. **[doc]** Delegating or forwarding between the two accounts is a separate question.
- Deliverability: Google's own infrastructure. Lock-in: Google Takeout and IMAP. **[inf]** Most expensive option here.

### Proton Mail
- Mail Plus: $2.49/mo on 12-month billing ($29.88 first year, then $47.88/yr), 15 GB, 10 addresses, 1 custom domain, catch-all. These are coupon prices. **[doc]** [proton.me/mail/pricing](https://proton.me/mail/pricing)
- Catch-all needs any paid plan. **[doc]** [proton.me/support/catch-all](https://proton.me/support/catch-all)
- DNS at Porkbun: verification TXT, 2 MX, SPF TXT, 3 DKIM CNAMEs, DMARC TXT. Values come from the Proton dashboard. **[doc]** [proton.me/support/custom-domain-porkbun](https://proton.me/support/custom-domain-porkbun)
- Export: the Proton Mail Export Tool writes EML and JSON. Proton Mail Bridge serves IMAP/SMTP to desktop clients (paid plans). **[doc]** [export tool](https://proton.me/support/proton-mail-export-tool), [MBOX/EML via Bridge](https://proton.me/support/import-export-mbox-eml-using-proton-mail-bridge) **[inf]**: end-to-end encryption means any mail client other than Proton's needs Bridge running, which adds friction.

### Zoho Mail
- Forever Free: up to 5 users, 1 custom domain, 5 GB, **no IMAP/POP/ActiveSync**, select data centres only. Mail Lite: $1.00/user/mo (5 GB) or $1.25 (10 GB), billed yearly only. **[doc]** [zoho.com/mail/zohomail-pricing](https://www.zoho.com/mail/zohomail-pricing.html)
- DNS: MX `mx.zoho.com` (10), `mx2.zoho.com` (20), `mx3.zoho.com` (50); hostnames vary by data centre, so use the Admin Console values. SPF `include:zohomail.com`. DKIM TXT `<selector>._domainkey`. **[doc]** [configure-email-delivery](https://www.zoho.com/mail/help/adminconsole/configure-email-delivery.html), [dkim-configuration](https://www.zoho.com/mail/help/adminconsole/dkim-configuration.html)
- Catch-all is supported. The page does not say which plans include it. **[doc]** [catch-all-setup](https://www.zoho.com/mail/help/adminconsole/catch-all-setup.html)
- Free sending works only in Zoho's web and mobile apps. **[inf]**
- Cheapest real mailbox. **[inf]** Its deliverability has a weaker reputation than Google's or Fastmail's, based on community reports only, which is not a primary source.

## Deliverability baseline

Gmail requires every sender to have SPF or DKIM, a DKIM key of 1024 bits or more, valid PTR, TLS, and a spam rate under 0.3%. Bulk senders (over 5,000 a day) also need DMARC with alignment. **[doc]** [support.google.com/mail/answer/81126](https://support.google.com/mail/answer/81126) Every mailbox provider above signs DKIM for your domain. Gmail send-as through smtp.gmail.com does not. **[doc]** (ImprovMX guide) For a personal low-volume sender, "aligned SPF + DKIM + a DMARC record from a reputable provider" is enough. **[inf]**

## DNS: stay at Porkbun or move to Cloudflare?

- **Only Cloudflare Email Routing forces a move to Cloudflare DNS.** **[doc]** Every other option documents third-party-DNS or Porkbun setup. **[doc]**
- On either DNS host, apex MX and TXT records sit alongside the GitHub Pages A/AAAA records without conflict, because they are different record types at the same name. **[inf]** Keep a single SPF TXT record at the apex. **[doc]** (Porkbun and Google SPF pages)
- With Fastmail, Proton, Zoho or Workspace you keep one DNS provider (Porkbun) and one bill fewer. **[inf]**

## Lock-in and keeping the address

The domain is registered at Porkbun, so the address belongs to the founder whatever happens to the provider. If a provider shuts or you leave, change the MX, SPF and DKIM records to a new one. **[inf]** What can be lost is stored mail. Fastmail, Workspace and Porkbun hosted allow IMAP export. Proton has the Export Tool. Forwarders store nothing. **[doc]**/**[inf]**

## Shortlist

1. **Fastmail Individual: about $60/yr. The best all-round choice if real sending is wanted.** It has catch-all, unlimited-feeling aliases, sending from any address, MX-only setup so DNS stays at Porkbun, standard protocols, a strong reputation, and a 30-day trial. Cost: a second inbox and app alongside the current one.
2. **Proton Mail Plus: about $30 the first year, then $48/yr.** The cheapest reputable full mailbox with catch-all, and DNS stays at Porkbun. Trade-offs: Bridge is needed for desktop clients, it allows only 1 custom domain, and the price is a coupon price that rises on renewal.
3. **Porkbun forwarding (free) or ImprovMX Free (free, with catch-all). The choice if receive-only is fine.** Nothing to manage, DNS stays at Porkbun. After January 2027 there is no clean way to reply as @shrujan.dev from Gmail. Choose ImprovMX over Porkbun if catch-all matters.

Not shortlisted:
- **Google Workspace:** the only way to keep using the Gmail UI to send as @shrujan.dev, but $84/yr after the intro price and a separate account.
- **Cloudflare:** it forces a DNS move, and sending is a beta transactional API rather than a personal mailbox.
- **Zoho Free:** no IMAP.
- **Porkbun hosted:** no published deliverability record or catch-all, and it costs about the same as Proton.

## The trade-offs the choice hangs on

1. **Is receive-only enough?** If yes, use a free forwarder and keep DNS at Porkbun. If not, pay for a mailbox, because Gmail send-as is ending.
2. **Must sending happen inside the existing Gmail?** Only Workspace does this after January 2027, at the highest cost and as a separate account. Otherwise accept a second app or inbox (Fastmail or Proton).
3. **Privacy versus convenience.** Proton gives end-to-end encryption, but desktop clients need Bridge. Fastmail is plain IMAP/JMAP with better integrations.
4. **Catch-all.** Porkbun forwarding and Porkbun hosted (not documented) are out if it matters.
5. **DNS host.** Only Cloudflare Email Routing forces a move. Pick it only if moving DNS to Cloudflare is wanted for other reasons.

## Open questions and unverified points

- Whether Google's January 2027 change also blocks custom-domain send-as through an external SMTP server. It is inferred yes; Google's page does not say.
- Google Workspace's flexible (monthly) Starter price, which was not captured from the pricing page.
- Porkbun hosted email: catch-all support, the backend provider, and the annual price.
- Which Zoho plans include catch-all, and whether Mail Lite includes IMAP/SMTP.
