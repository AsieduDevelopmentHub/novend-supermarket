## Final Feature Implementation and Release

This may be the final major feature for now.

**Implementation record:** [`GPT_FEATURE_IMAGES_AND_SALES_DISPLAY.md`](./GPT_FEATURE_IMAGES_AND_SALES_DISPLAY.md)

### 1. Product-image controls

Add organization-level control over product-image uploads:

* Platform administrators can enable or disable product-image uploads for a specific organization.
* Organization administrators can also disable or re-enable product images for their own organization.
* When disabled:

  * Hide or disable image-upload controls.
  * Prevent image uploads on the backend.
  * Continue displaying existing product images unless a separate removal option is selected.
  * Ensure the restriction works online and offline.
* Record changes in the audit log.

### 2. Sales product-display preferences

Add multiple display modes for products on the Sales page:

* List view
* Standard grid
* Small cards/icons
* Medium cards
* Five products per row
* Configurable number of products per row where screen size permits

Requirements:

* Make the layout fully responsive.
* Prevent excessive shrinking on smaller screens.
* Save each user’s preferred view locally so it works offline.
* Optionally sync the preference across the user’s devices.
* Keep product names, prices, stock status and images readable in every mode.
* Ensure barcode scanning, product selection and cart operations behave identically across all views.

### 3. Verification and release workflow

After implementation:

1. Run linting, type checking, tests, formatting checks and the production build.
2. Test the feature on desktop, web and mobile layouts.
3. Verify administrator permissions and organization isolation.
4. Verify the settings and selected sales view work offline.
5. Commit the completed changes.
6. Push them to the `staging` branch.
7. Confirm staging is stable.
8. Open a pull request from `staging` into `main`.
9. Include a clear PR description, testing evidence, screenshots and any migration or deployment instructions.
