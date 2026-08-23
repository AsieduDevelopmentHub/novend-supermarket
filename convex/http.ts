import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { assetHttp, feedHttp, latestMetaHttp, publishHttp, purgeHttp } from "./desktopReleases";
import {
  assetHttp as mobileAssetHttp,
  latestMetaHttp as mobileLatestMetaHttp,
  publishHttp as mobilePublishHttp,
  purgeHttp as mobilePurgeHttp,
} from "./mobileReleases";
import { paystackWebhookHttp } from "./billingHttp";

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({
  path: "/billing/paystack/webhook",
  method: "POST",
  handler: paystackWebhookHttp,
});

http.route({
  path: "/desktop-updates/publish",
  method: "POST",
  handler: publishHttp,
});

http.route({
  path: "/desktop-updates/purge",
  method: "POST",
  handler: purgeHttp,
});

http.route({
  pathPrefix: "/desktop-updates/feed/",
  method: "GET",
  handler: feedHttp,
});

http.route({
  pathPrefix: "/desktop-updates/assets/",
  method: "GET",
  handler: assetHttp,
});

http.route({
  path: "/desktop-updates/latest",
  method: "GET",
  handler: latestMetaHttp,
});

http.route({
  path: "/mobile-updates/publish",
  method: "POST",
  handler: mobilePublishHttp,
});

http.route({
  path: "/mobile-updates/purge",
  method: "POST",
  handler: mobilePurgeHttp,
});

http.route({
  pathPrefix: "/mobile-updates/assets/",
  method: "GET",
  handler: mobileAssetHttp,
});

http.route({
  path: "/mobile-updates/latest",
  method: "GET",
  handler: mobileLatestMetaHttp,
});

export default http;
