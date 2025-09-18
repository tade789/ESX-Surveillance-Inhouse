// core/script.js
import { Auth } from "./auth.js";
import { DataManager } from "./dataManager.js";

// Utility to dynamically load HTML into a section
async function loadSection(sectionId, htmlPath, jsPath, initFuncName) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  // Load HTML (if empty or forced reload)
  if (!section.dataset.loaded) {
    const resp = await fetch(htmlPath);
    section.innerHTML = await resp.text();
    section.dataset.loaded = "true";

    // Load JS module and run its init()
    if (jsPath) {
      const module = await import(jsPath);
      if (module[initFuncName]) module[initFuncName]();
    }
  }
}

// Navigation handling
function setupNavigation() {
  const menuItems = document.querySelectorAll("[data-section]");
  menuItems.forEach(item => {
    item.addEventListener("click", async () => {
      const target = item.dataset.section;

      // deactivate others
      document.querySelectorAll(".menu-item, .dropdown-content div")
        .forEach(el => el.classList.remove("active"));
      item.classList.add("active");

      // hide all sections
      document.querySelectorAll(".content-section")
        .forEach(sec => sec.classList.remove("active"));

      // show target
      const section = document.getElementById(target);
      if (section) {
        section.classList.add("active");
      }

      // dynamically load content
      switch (target) {
        case "home":
          await loadSection("home", "menus/Home/Home.html", "/menus/Home/Home.js", "initHome");
          break;
    
        case "insider-trading":
          await loadSection("insider-trading", "menus/Insider Trading & Misuse/Insider Trading.html", "/menus/Insider Trading & Misuse/Insider Trading.js", "initInsider");
          break;
        case "front-running":
          await loadSection("front-running", "menus/Insider Trading & Misuse/frontRunning.html", "/menus/Insider Trading & Misuse/frontRunning.js", "initFrontRunning");
          break;
        case "dormancy":
          await loadSection("dormancy", "menus/Insider Trading & Misuse/dormancy.html", "/menus/Insider Trading & Misuse/dormancy.js", "initDormancy");
          break;
        case "publication":
          await loadSection("publication", "menus/Insider Trading & Misuse/publication.html", "/menus/Insider Trading & Misuse/publication.js", "initPublication");
          break;

        case "mark-open":
          await loadSection("mark-open", "menus/Price Manipulation/markOpen.html", "/menus/Price Manipulation/markOpen.js", "initMarkOpen");
          break;
        case "mark-close":
          await loadSection("mark-close", "menus/Price Manipulation/markClose.html", "/menus/Price Manipulation/markClose.js", "initMarkClose");
          break;
        case "pump-dump":
          await loadSection("pump-dump", "menus/Price Manipulation/pumpDump.html", "/menus/Price Manipulation/pumpDump.js", "initpumpDump");
          break;
        case "cornering":
          await loadSection("cornering", "menus/Price Manipulation/cornering.html", "/menus/Price Manipulation/cornering.js", "initCornering");
          break;

        case "spoofing":
          await loadSection("spoofing", "menus/Order Book Manipulation/spoofing.html", "/menus/Order Book Manipulation/spoofing.js", "initSpoofing");
          break;
        case "layering":
          await loadSection("layering", "menus/Order Book Manipulation/layering.html", "/menus/Order Book Manipulation/layering.js", "initLayering");
          break;

        case "wash-trading":
          await loadSection("wash-trading", "menus/Trade based Manipulation/washTrading.html", "/menus/Trade based Manipulation/washTrading.js", "initWashTrading");
          break;
        case "churning":
          await loadSection("churning", "menus/Trade based Manipulation/churning.html", "/menus/Trade based Manipulation/churning.js", "initChurning");
          break;
        case "circular-trading":
          await loadSection("circular-trading", "menus/Trade based Manipulation/circular trading.html", "/menus/Trade based Manipulation/circular trading.js", "initCircularTrading");
          break;

        case "abnormal-volume":
          await loadSection("abnormal-volume", "menus/Volume & Liquidity/abnormalVolume.html", "/menus/Volume & Liquidity/abnormalVolume.js", "initAbnormalVolume");
          break;
        case "illiquid-trading":
          await loadSection("illiquid-trading", "menus/Volume & Liquidity/Trading in Illiquid Securities.html", "/menus/Volume & Liquidity/Trading in Illiquid Securities.js", "initIlliquidTrading");
          break;
        case "trade-to-order":
          await loadSection("trade-to-order", "menus/Volume & Liquidity/Trade-to-Order Ratio.html", "/menus/Volume & Liquidity/Trade-to-Order Ratio.js", "initTradeToOrder");
          break;

        case "about":
          await loadSection("about", "menus/Settings/about.html", "/menus/Settings/about.js", "initAbout");
          break;

        case "change-password":
          await loadSection("change-password", "menus/Settings/changePassword.html", "/menus/Settings/changePassword.js", "initchangePassword");
          break;

        
      }
    });
  });
}

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  // bootstrap login/logout
  Auth.init();

  // setup navigation
  setupNavigation();

  // load Home immediately after login
  document.addEventListener("auth:login", async () => {
    await loadSection("home", "menus/Home/Home.html", "/menus/Home/Home.js", "initHome");
    document.querySelector("[data-section='home']").click();
  });

  // clear dataset on logout
  document.addEventListener("auth:logout", () => {
    DataManager.clearData();
  });
});
