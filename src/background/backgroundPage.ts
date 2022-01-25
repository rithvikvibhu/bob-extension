import {browser} from "webextension-polyfill-ts";
import WalletService from "@src/background/services/wallet";
import {MessageAction} from "@src/util/postMessage";
import {AppService} from "@src/util/svc";
import SettingService from "@src/background/services/setting";
import NodeService from "@src/background/services/node";
import controllers from "@src/background/controllers";
import MessageTypes from "@src/util/messageTypes";
import AnalyticsService from "@src/background/services/analytics";
import resolve from "@src/background/resolve";

(async function () {
  let app: AppService;

  browser.runtime.onMessage.addListener(async (request: any, sender: any) => {
    await waitForStartApp();

    try {
      const res = await handleMessage(app, request);
      return [null, res];
    } catch (e: any) {
      return [e.message, null];
    }
  });

  const startedApp = new AppService();
  startedApp.add("setting", new SettingService());
  startedApp.add("analytics", new AnalyticsService());
  startedApp.add("node", new NodeService());
  startedApp.add("wallet", new WalletService());
  await startedApp.start();
  app = startedApp;

  browser.webRequest.onBeforeRequest.addListener(
    // @ts-ignore
    resolve.bind(this, app),
    // () => ({ redirectUrl: 'data:text/html;base64,PCFET0NUWVBFIGh0bWw+CjxodG1sPgo8aGVhZD4KICA8bWV0YSBjaGFyc2V0PSJ1dGYtOCI+CiAgPG1ldGEgaHR0cC1lcXVpdj0iWC1VQS1Db21wYXRpYmxlIiBjb250ZW50PSJJRT1lZGdlIj4KICA8dGl0bGU+RGVtbyBQYWdlPC90aXRsZT4KICA8bGluayByZWw9InN0eWxlc2hlZXQiIGhyZWY9Ii4vaW5kZXguY3NzIj4KPC9oZWFkPgo8Ym9keT4KICA8aDE+SGVsbG88L2gxPgogIDxkaXY+CiAgICBIZWxsbywgV29ybGQKICA8L2Rpdj4KPC9ib2R5Pgo8L2h0bWw+'}),
    {urls: ["<all_urls>"]},
    ["blocking"]
  );

  app.on("wallet.locked", async () => {
    const tabs = await browser.tabs.query({active: true});
    for (let tab of tabs) {
      await browser.tabs.sendMessage(tab.id as number, {
        type: MessageTypes.DISCONNECTED,
      });
    }
  });

  browser.omnibox.onInputEntered.addListener(async (text, disposition) => {
    await waitForStartApp();
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    browser.tabs.update(tab.id, {
      url: browser.extension.getURL('federalist.html') + '?h=' + text,
    });
  });

  async function waitForStartApp() {
    return new Promise((resolve) => {
      if (app) {
        resolve(true);
        return;
      }

      setTimeout(async () => {
        await waitForStartApp();
        resolve(true);
      }, 500);
    });
  }
})();

function handleMessage(app: AppService, message: MessageAction) {
  const controller = controllers[message.type];

  if (controller) {
    return controller(app, message);
  }
}
