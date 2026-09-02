Now that everything is working perfectly, I want us to implement a **core feature: a Customer Display / Second Screen system**.

The goal is to support a **customer-facing display on Electron POS**, using a second monitor connected to the same computer. If technically feasible, we should also explore supporting the same experience on **desktop web**.

### Requirements

* Add a dedicated **Customer Display** view designed specifically for the customer-facing screen.
* On Electron, detect/use a connected secondary display and open the Customer Display window there.
* Keep the cashier/POS screen completely independent from the customer screen.
* Customer Display should update **in real time** as the cashier:

  * Adds/removes products
  * Changes quantities
  * Applies discounts
  * Updates totals
  * Completes/cancels a sale
* Show a clean customer-facing experience:

  * Business/Novend branding
  * Cart items
  * Product images where available
  * Quantities and prices
  * Discounts
  * Subtotal
  * Tax
  * Grand total
  * Payment status
  * Thank-you/completed-sale state
* It must work **offline-first** and must not depend on Convex/network connectivity for real-time updates.
* Use the existing POS/cart state and architecture rather than creating a duplicate sales system.
* Properly handle Electron multi-window lifecycle, display detection, window closing, reconnecting, and app restart.
* If possible, design the architecture so **desktop web can also support a second-screen/customer-display mode**, while respecting browser limitations around opening windows and multi-monitor placement.
* Keep the implementation modular so it can later support additional customer-display features such as promotional banners, loyalty information, or QR/payment displays.

### Important

Before implementing, **audit the existing Electron architecture, POS/cart state, routing, and desktop window management** and determine the cleanest approach. Do not create a parallel state-management system or workaround if the existing architecture can be extended.

Implement this as a **production-quality core feature**, including responsive UI, proper error/edge-case handling, tests, and a meaningful Git commit.


before you start commiting lemme do personal tests before we start pushing to git. and show me workaround on how to test locally
