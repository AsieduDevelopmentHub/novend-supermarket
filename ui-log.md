## Error Type
Console Error

## Error Message
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:

- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

https://react.dev/link/hydration-mismatch

  ...
    <SegmentViewNode type="page" pagePath="(site)/pri...">
      <SegmentTrieNode>
      <PricingPage>
        <PricingPageView>
          <div className="bg-[#F8FAFC]">
            <section>
            ...
              <section id="pricing" aria-labelledby={undefined} className="relative s...">
                <div className="mx-auto ma...">
                  <header>
                  <PricingCards cycle="monthly">
                    <ul data-reveal={true} className="landing-pr...">
                      <li className="landing-pr...">
                        <span>
                        <h3>
                        <p>
                        <div>
                        <ul>
                        <ul>
                        <div className="mt-7">
                          <_c asChild={true} variant="outline" className="h-11 w-ful...">
                            <Slot.Slot className={"inline-f..."} ref={null}>
                              <LinkComponent href={"/signup?..."} className={"inline-f..."} ref={null}>
                                <a
                                  className={"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded..."}
                                  ref={function}
                                  onClick={function onClick}
                                  onMouseEnter={function onMouseEnter}
                                  onTouchStart={function onTouchStart}
+                                 href={"/signup?plan=basic&cycle=monthly"}
-                                 href={"https://dashboard.novendpos.app/signup?plan=basic&cycle=monthly"}
                                >
+                                 Start free trial
                      <li className="landing-pr...">
                        <span>
                        <h3>
                        <p>
                        <div>
                        <ul>
                        <ul>
                        <div className="mt-7">
                          <_c asChild={true} variant="default" className="h-11 w-ful...">
                            <Slot.Slot className={"inline-f..."} ref={null}>
                              <LinkComponent href={"/signup?..."} className={"inline-f..."} ref={null}>
                                <a
                                  className={"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded..."}
                                  ref={function}
                                  onClick={function onClick}
                                  onMouseEnter={function onMouseEnter}
                                  onTouchStart={function onTouchStart}
+                                 href={"/signup?plan=pro&cycle=monthly"}
-                                 href={"https://dashboard.novendpos.app/signup?plan=pro&cycle=monthly"}
                                >
+                                 Start free trial
                      ...
                  ...
            ...
    ...



    at a (<anonymous>:null:null)
    at <unknown> (features/marketing/components/landing-pricing.tsx:287:19)
    at Array.map (<anonymous>:null:null)
    at PricingCards (features/marketing/components/landing-pricing.tsx:192:19)
    at _c (components/ui/button.tsx:41:7)
    at <unknown> (features/marketing/components/landing-pricing.tsx:276:15)
    at Array.map (<anonymous>:null:null)
    at PricingCards (features/marketing/components/landing-pricing.tsx:192:19)
    at LandingPricing (features/marketing/components/landing-pricing.tsx:112:9)
    at PricingPageView (features\marketing\components\pricing-page-view.tsx:44:7)
    at PricingPage (app\(site)\pricing\page.tsx:13:10)

## Code Frame
  285 |                   <a href={ctaHref}>{cta.label}</a>
  286 |                 ) : (
> 287 |                   <Link href={ctaHref}>{cta.label}</Link>
      |                   ^
  288 |                 )}
  289 |               </Button>
  290 |             </div>

Next.js version: 16.3.5 (Turbopack)
