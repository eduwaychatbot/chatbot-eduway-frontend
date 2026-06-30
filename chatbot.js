(function () {
  // --- Configuration ---
  const scriptTag = document.currentScript;
  const universityName =
    scriptTag.getAttribute("data-university-name") || "My Bot";

  // IMAGE HANDLING: Retrieve icon and fix spaces in URL
  let rawIcon = scriptTag.getAttribute("data-university-icon") || "default";
  const universityIcon = rawIcon.startsWith("http")
    ? rawIcon.replace(/ /g, "%20")
    : rawIcon;

  const assistantId =
    scriptTag.getAttribute("data-assistant-id") || "test-assistant";

  // --- Global service config ---
  // These are the SAME for every customer, so they live here (in the file you
  // control), NOT in the copy-paste embed snippet. The data-* attributes remain
  // as optional overrides (handy for local testing), but customers never need
  // to include them.
  const DEFAULT_API_URL = "https://eduwayai.com/chatbot"; // production backend (override per-embed with data-api-url)
  const DEFAULT_TURNSTILE_SITEKEY = "0x4AAAAAADiqq1CFrkqUzzr6";

  // Backend base URL (no trailing slash).
  const apiUrl = (
    scriptTag.getAttribute("data-api-url") || DEFAULT_API_URL
  ).replace(/\/+$/, "");

  // Cloudflare Turnstile site key (public). If empty, the bot check is skipped
  // and the widget just requests a session directly (matches dev mode backend).
  const turnstileSiteKey =
    scriptTag.getAttribute("data-turnstile-sitekey") || DEFAULT_TURNSTILE_SITEKEY;

  const primaryColor =
    scriptTag.getAttribute("data-primary-color") || "rgb(76,154,227)";
  const userColor =
    scriptTag.getAttribute("data-user-color") || "rgb(230, 230, 230)";
  const botColor =
    scriptTag.getAttribute("data-bot-color") || "rgb(240, 240, 240)";

  // Launcher placement + message text colours + drag toggle. Defaults keep the
  // historic behaviour (bottom-right, dark text, no drag) for old embeds that
  // don't send these attributes.
  const position = scriptTag.getAttribute("data-position") || "right";
  const draggable =
    (scriptTag.getAttribute("data-draggable") || "false") === "true";
  const botTextColor =
    scriptTag.getAttribute("data-bot-text-color") || "#2C2C2C";
  const userTextColor =
    scriptTag.getAttribute("data-user-text-color") || "#2C2C2C";

  const headerTextColor = "#162149";
  const closeIconColor = "#E9E4FE";
  const dividerColor = "rgba(235, 227, 252, 1)";
  const inputBorderColor = primaryColor;

  let isWaitingForResponse = false;
  let threadId = null;
  let sessionToken = null;
  // Set true by a real drag so the click that follows pointerup doesn't open chat.
  let justDragged = false;
  // While the launcher is lifted/dragging, ignore hover-scale so it doesn't
  // fight the drag transform.
  let suppressHover = false;

  // --- Import Fonts ---
  const fontLink = document.createElement("link");
  fontLink.href =
    "https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap";
  fontLink.rel = "stylesheet";
  document.head.appendChild(fontLink);

  // --- Styles ---
  const style = document.createElement("style");
  style.innerHTML = `
      /* Message Animation: Slide Up + Fade In */
      @keyframes edw-msg-fade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
      }

      .edw-message-animate {
          animation: edw-msg-fade 0.3s ease-out forwards;
      }

      .edw-typing-indicator {
          display: flex;
          align-items: baseline;
          padding: 15px 14px !important;
      }
      .edw-typing-indicator span {
          height: 6px;
          width: 6px;
          margin: 0 2px;
          background-color: rgba(0, 0, 0, 0.4);
          border-radius: 50%;
          display: inline-block;
          animation: edw-bounce 1.4s infinite ease-in-out both;
      }
      .edw-typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
      .edw-typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
      
      @keyframes edw-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
      }

      @keyframes edw-slideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes edw-slideOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(20px) scale(0.95); }
      }

      .edw-chat-window-open {
          display: flex !important;
          animation: edw-slideIn 0.3s ease-out forwards;
      }

      .edw-chat-window-closed {
          display: flex !important;
          animation: edw-slideOut 0.3s ease-in forwards;
          pointer-events: none;
      }

      #edw-chatInput::placeholder { color: #ccc; }
      #edw-chatInput:focus { border-width: 2px; padding: 9px 15px; }
      
      #edw-chatMessages {
          margin-top: 0px !important;
          scrollbar-width: thin; 
          scrollbar-color: #ccc transparent;
      }
      /* Bot message HTML content styling */
      .edw-bot-content {
          /* NEW: Ensures whitespace is respected if parsing fails */
          white-space: pre-wrap; 
      }
      .edw-bot-content p {
          margin: 0 0 8px 0;
          white-space: normal; /* Reset for paragraphs */
      }
      .edw-bot-content p:last-child {
          margin-bottom: 0;
      }
      .edw-bot-content ul,
      .edw-bot-content ol {
          margin: 4px 0 8px 0;
          padding-left: 20px;
          list-style-type: disc; /* Ensure bullets show */
          white-space: normal;
      }
      .edw-bot-content ul:last-child,
      .edw-bot-content ol:last-child {
          margin-bottom: 0;
      }
      .edw-bot-content li {
          margin-bottom: 4px;
      }
      .edw-bot-content li:last-child {
          margin-bottom: 0;
      }
      .edw-bot-content strong {
          font-weight: 600;
      }
      .edw-bot-content code {
          background: rgba(0,0,0,0.06);
          padding: 1px 4px;
          border-radius: 4px;
          font-size: 13px;
      }
      .edw-bot-content pre {
          background: rgba(0,0,0,0.06);
          padding: 10px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 4px 0 8px 0;
      }
      .edw-bot-content pre code {
          background: none;
          padding: 0;
      }
      .edw-bot-content h1, .edw-bot-content h2, .edw-bot-content h3 {
          margin: 0 0 6px 0;
          font-size: 14px;
          font-weight: 700;
      }
      .edw-bot-content a {
          color: inherit;
          text-decoration: underline;
      }

      /* Queued-message indicator */
      @keyframes edw-queue-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
      }
      .edw-queue-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          align-self: flex-end;
          background: #f1f1f4;
          color: #7a7a84;
          font-size: 11px;
          font-family: 'Poppins', sans-serif;
          font-weight: 500;
          padding: 5px 11px 5px 9px;
          border-radius: 999px;
          margin: -6px 2px 0 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          animation: edw-queue-pulse 1.8s ease-in-out infinite;
      }
      .edw-queue-tag svg {
          flex-shrink: 0;
          animation: edw-queue-spin 2.4s linear infinite;
      }
      @keyframes edw-queue-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
      }
  `;

  document.head.appendChild(style);

  // --- Helper: Generate Clean Avatar HTML ---
  const getAvatarHTML = (size) => {
    const sizePx = typeof size === "number" ? `${size}px` : size;
    const iconColor =
      primaryColor && primaryColor !== "default" ? primaryColor : "#162149";

    const fallbackIcon = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" 
               style="width: 55%; height: 55%; fill: ${iconColor}; display: block; z-index: 1;">
              <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" />
          </svg>
      `;

    let imgTag = "";
    if (universityIcon && universityIcon.startsWith("http")) {
      imgTag = `
              <img src="${universityIcon}" 
                   style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; background: #fff; z-index: 2;" 
                   onerror="this.style.display='none'" 
                   alt="Bot Avatar">
          `;
    }

    return `
          <div style="width:${sizePx}; height:${sizePx}; min-width:${sizePx}; border-radius:50%; overflow:hidden; background:#f0f0f0; display:flex; align-items:center; justify-content:center; position: relative;">
              ${fallbackIcon}
              ${imgTag}
          </div>
      `;
  };

  // --- Chat Bubble (Launcher) ---
  const launcher = document.createElement("div");
  launcher.id = "edw-launcher";
  launcher.innerHTML = getAvatarHTML("100%");

  Object.assign(launcher.style, {
    position: "fixed",
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    background: "#fff",
    color: "#000",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
    zIndex: 9999,
    border: "none",
    transition: "transform 0.2s",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    userSelect: "none",
    webkitUserSelect: "none",
    WebkitUserSelect: "none", // capital-W form for broader browser compatibility
  });

  launcher.onmouseenter = () => {
    if (!suppressHover) launcher.style.transform = "scale(1.1)";
  };
  launcher.onmouseleave = () => {
    if (!suppressHover) launcher.style.transform = "scale(1)";
  };
  // Stop the browser's native image/element drag (the translucent "ghost" of the
  // avatar) so our move-to-grab drag is the only drag behaviour.
  launcher.setAttribute("draggable", "false");
  launcher.addEventListener("dragstart", (e) => e.preventDefault());
  document.body.appendChild(launcher);

  // --- Chat Window ---
  const chatWindow = document.createElement("div");
  chatWindow.id = "edw-chatWindow";
  Object.assign(chatWindow.style, {
    position: "fixed",
    width: "360px",
    height: "500px",
    maxWidth: "calc(100vw - 40px)",
    background: "#ffffff",
    borderRadius: "16px",
    border: "1px solid #e0e0e0",
    display: "none",
    flexDirection: "column",
    overflow: "hidden",
    fontFamily: "'Poppins', sans-serif",
    zIndex: 9999,
    boxShadow: "0 5px 20px rgba(0,0,0,0.1)",
  });

  const closeIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1L13 13" stroke="${closeIconColor}" stroke-width="2.5" stroke-linecap="round"/><path d="M13 1L1 13" stroke="${closeIconColor}" stroke-width="2.5" stroke-linecap="round"/></svg>`;

  chatWindow.innerHTML = `
      <div style="padding:16px 16px 0px 16px; background: #fff; display:flex; flex-direction:column;">
          <div style="display:flex; align-items:center; gap: 12px; padding-bottom:12px;">
              ${getAvatarHTML("40px")}
              <span style="font-weight:bold; color:${headerTextColor}; font-size:16px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${universityName}
              </span>
              <span id="edw-closeChat" style="cursor:pointer; display:flex; align-items:center; justify-content:center; width:24px; height:24px;">
                  ${closeIconSvg}
              </span>
          </div>
          <div style="height:1px; background:${dividerColor}; width:100%;"></div>
      </div>
      
      <div id="edw-chatMessages" style="flex:1; padding:20px 16px 16px 16px; overflow-y:auto; display:flex; flex-direction:column; gap:12px;"></div>
      
      <div style="padding: 0 16px 16px 16px; background: #fff;">
          <div style="height:1px; background:${dividerColor}; margin-bottom: 16px;"></div>
          <div style="display:flex; align-items:center; gap:8px;">
              <input id="edw-chatInput" type="text" placeholder="Write your message..." style="flex:1; height:48px; padding:10px 16px; border-radius:12px; border: 1.5px solid ${inputBorderColor}; outline:none; font-size:14px; font-family: 'Poppins'; box-sizing: border-box;" />
              <button id="edw-sendChat" style="
                  width:36px !important; 
                  height:36px !important; 
                  border-radius:50% !important; 
                  background:${primaryColor} !important; 
                  color:white !important; 
                  border:none !important; 
                  display:flex !important; 
                  justify-content:center !important; 
                  align-items:center !important; 
                  cursor:pointer !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  box-shadow: none !important;
                  min-width: 36px !important;
              ">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="pointer-events: none;"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2v7z"/></svg>
              </button>
          </div>
      </div>
  `;

  document.body.appendChild(chatWindow);

  // --- Placement -------------------------------------------------------------
  // Launcher + window placement. Presets anchor to a bottom corner; the "-up"
  // variants raise the launcher so it clears an existing corner button. Drag
  // (below) re-anchors to whichever screen corner the user releases nearest.
  const MARGIN = 20;
  const LAUNCHER_SIZE = 60;
  const GAP = 10;
  const POS_SIDE = position.indexOf("left") === 0 ? "left" : "right";
  const POS_RAISED = position.indexOf("-up") !== -1;

  function clearPlacement(el) {
    el.style.top = "";
    el.style.bottom = "";
    el.style.left = "";
    el.style.right = "";
  }

  // Place the window adjacent to the launcher, opening away from the anchored
  // edge, and cap its height to the room between that edge and the opposite
  // margin so it never runs off-screen (the messages list scrolls inside).
  function placeWindow(horiz, vert, launcherInset) {
    clearPlacement(chatWindow);
    chatWindow.style[horiz] = MARGIN + "px";
    const offset = launcherInset + LAUNCHER_SIZE + GAP;
    chatWindow.style[vert] = offset + "px";
    chatWindow.style.maxHeight = `calc(100vh - ${offset + MARGIN}px)`;
  }

  // Anchor the launcher (and its window) to a side + edge, `inset` px from that
  // edge. An inset larger than MARGIN on the bottom edge yields a "raised"
  // position that clears a button the host site may have in that corner.
  function applyAnchor(horiz, vert, inset) {
    clearPlacement(launcher);
    launcher.style[horiz] = MARGIN + "px";
    launcher.style[vert] = inset + "px";
    placeWindow(horiz, vert, inset);
  }

  // Apply the admin-configured preset (with the optional raise).
  function applyPreset() {
    const inset = POS_RAISED ? MARGIN + LAUNCHER_SIZE + GAP : MARGIN;
    applyAnchor(POS_SIDE, "bottom", inset);
  }

  // Anchor to a side at an ARBITRARY vertical position (used after a free drag):
  // the launcher hugs the nearest side at the height it was dropped, and the
  // window opens toward whichever vertical side has more room.
  function applyFreeAnchor(horiz, topY) {
    clearPlacement(launcher);
    launcher.style[horiz] = MARGIN + "px";
    launcher.style.top = topY + "px";

    clearPlacement(chatWindow);
    chatWindow.style[horiz] = MARGIN + "px";

    const launcherTop = topY;
    const launcherBottom = topY + LAUNCHER_SIZE;
    if (launcherTop + LAUNCHER_SIZE / 2 < window.innerHeight / 2) {
      // Open DOWNWARD: window starts a GAP below the launcher's BOTTOM edge, so
      // the offset includes the launcher's height.
      const offset = launcherBottom + GAP;
      chatWindow.style.top = offset + "px";
      chatWindow.style.maxHeight = `calc(100vh - ${offset + MARGIN}px)`;
    } else {
      // Open UPWARD: the window's bottom edge sits a GAP above the launcher's TOP
      // edge. As a CSS `bottom` (measured from the viewport bottom) that's
      // innerHeight - launcherTop + GAP — the launcher's height is already
      // accounted for by anchoring to its TOP, so NO LAUNCHER_SIZE term is added
      // (adding one would push the window down into the launcher).
      const offset = window.innerHeight - launcherTop + GAP;
      chatWindow.style.bottom = offset + "px";
      chatWindow.style.maxHeight = `calc(100vh - ${offset + MARGIN}px)`;
    }
  }

  applyPreset();

  const chatMessages = chatWindow.querySelector("#edw-chatMessages");
  const chatInput = chatWindow.querySelector("#edw-chatInput");
  const sendChat = chatWindow.querySelector("#edw-sendChat");
  const closeChatBtn = chatWindow.querySelector("#edw-closeChat");

  const scrollToBottom = () => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  // --- NEW FUNCTION: Parse Markdown to HTML ---
  function parseMarkdown(text) {
    if (!text) return "";

    // 1. Escape basic HTML (Prevent XSS)
    let clean = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 2. Bold (**text**)
    clean = clean.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // 3. Process Lines for Lists
    let lines = clean.split("\n");
    let output = "";
    let inList = false;

    lines.forEach((line) => {
      let trimmed = line.trim();
      // Check if line starts with "- " or "* " (standard markdown lists)
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        if (!inList) {
          output += "<ul>";
          inList = true;
        }
        // Wrap content in <li>
        output += `<li>${trimmed.substring(2)}</li>`;
      } else {
        if (inList) {
          output += "</ul>";
          inList = false;
        }
        // Handle non-list lines
        if (trimmed.length > 0) {
          output += `<p>${trimmed}</p>`;
        }
      }
    });

    if (inList) output += "</ul>";

    return output;
  }

  function appendBotMessage(htmlContent, isError = false, beforeNode = null) {
    const botMsg = document.createElement("div");
    botMsg.className = "edw-message-animate";
    Object.assign(botMsg.style, {
      background: isError ? "#D32F2F" : botColor,
      color: isError ? "#fff" : botTextColor,
      padding: "15px 14px",
      borderRadius: "12px 12px 12px 0px",
      maxWidth: "85%",
      alignSelf: "flex-start",
      wordWrap: "break-word",
      fontFamily: "Poppins",
      fontSize: "14px",
    });

    if (htmlContent === "typing-indicator") {
      botMsg.className = "edw-typing-indicator";
      botMsg.classList.add("edw-message-animate");
      botMsg.innerHTML = `Typing <span></span><span></span><span></span>`;
    } else {
      // MODIFIED: Use the parseMarkdown function here
      const parsedContent = isError ? htmlContent : parseMarkdown(htmlContent);
      botMsg.innerHTML = `<div class="edw-bot-content">${parsedContent}</div>`;
    }

    if (beforeNode) {
      chatMessages.insertBefore(botMsg, beforeNode);
    } else {
      chatMessages.appendChild(botMsg);
    }
    scrollToBottom();
    return botMsg;
  }

  // --- Actions ---
  launcher.onclick = () => {
    // A drag just ended — swallow this synthetic click so it doesn't open chat.
    if (justDragged) {
      justDragged = false;
      return;
    }
    if (chatWindow.classList.contains("edw-chat-window-open")) {
      closeChat();
    } else {
      chatWindow.classList.remove("edw-chat-window-closed");
      chatWindow.classList.add("edw-chat-window-open");
      chatInput.focus();
      // Pre-warm the session (runs the bot check now) so the first message
      // sends instantly instead of waiting on verification.
      ensureSession();
    }
  };

  const closeChat = () => {
    chatWindow.classList.replace(
      "edw-chat-window-open",
      "edw-chat-window-closed",
    );
    setTimeout(() => {
      if (chatWindow.classList.contains("edw-chat-window-closed")) {
        chatWindow.style.display = "none";
      }
    }, 300);
  };

  closeChatBtn.onclick = closeChat;

  // --- Drag to reposition (move-to-grab, animated corner-snap, opt-in) -------
  // No hold required: press and move past a small threshold and the launcher
  // lifts and follows the pointer immediately. On release it animates into the
  // nearest corner. A plain click (no movement) still opens the chat via
  // launcher.onclick — a double-click behaves the same, since there's no hold.
  if (draggable) {
    const DRAG_THRESHOLD = 6; // px of movement before a press becomes a drag
    const SNAP_MS = 480; // drop animation duration (slower, smoother glide)
    const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
    const REST_SHADOW = "0 4px 12px rgba(0,0,0,0.15)";
    const LIFT_SHADOW = "0 12px 26px rgba(0,0,0,0.28)";

    let dragging = false;
    let pointerDown = false;
    let offsetX = 0;
    let offsetY = 0;
    let startX = 0;
    let startY = 0;
    // Set while a drop animation is in flight so a new gesture can settle it
    // immediately (otherwise its delayed finalize re-anchors with stale coords).
    let pendingFinalize = null;

    launcher.style.cursor = "grab";
    launcher.style.touchAction = "none";

    const settle = () => {
      suppressHover = false;
      launcher.style.cursor = "grab";
      launcher.style.transform = "scale(1)";
      launcher.style.boxShadow = REST_SHADOW;
    };

    // First movement past the threshold → pick the launcher up: switch to
    // absolute left/top at its current spot (so drag + snap animate cleanly)
    // and show the lifted state.
    const lift = () => {
      dragging = true;
      suppressHover = true;
      const rect = launcher.getBoundingClientRect();
      clearPlacement(launcher);
      launcher.style.left = rect.left + "px";
      launcher.style.top = rect.top + "px";
      launcher.style.transition = `transform 0.15s ${EASE}, box-shadow 0.15s ${EASE}`;
      launcher.style.transform = "scale(1.12)";
      launcher.style.boxShadow = LIFT_SHADOW;
      launcher.style.cursor = "grabbing";
      if (chatWindow.classList.contains("edw-chat-window-open")) closeChat();
    };

    // Snap horizontally to the nearest side, but keep the vertical position
    // where it was dropped (clamped to the viewport) — so it can rest at ANY
    // height to clear a host-site button anywhere on that side.
    const snapToAnchor = () => {
      const rect = launcher.getBoundingClientRect();
      const horiz =
        rect.left + LAUNCHER_SIZE / 2 < window.innerWidth / 2 ? "left" : "right";
      const targetX =
        horiz === "left" ? MARGIN : window.innerWidth - MARGIN - LAUNCHER_SIZE;
      const targetY = Math.max(
        MARGIN,
        Math.min(rect.top, window.innerHeight - MARGIN - LAUNCHER_SIZE),
      );

      launcher.style.transition =
        `left ${SNAP_MS}ms ${EASE}, top ${SNAP_MS}ms ${EASE}, ` +
        `transform 0.2s ${EASE}, box-shadow 0.2s ${EASE}`;
      clearPlacement(launcher);
      launcher.style.left = targetX + "px";
      launcher.style.top = targetY + "px";
      launcher.style.transform = "scale(1)";
      launcher.style.boxShadow = REST_SHADOW;

      // Declared before finalize so the closure never hits the temporal dead
      // zone if it runs before the assignment line below.
      let fallback;
      const finalize = () => {
        if (pendingFinalize !== finalize) return; // already ran or was superseded
        pendingFinalize = null;
        clearTimeout(fallback);
        launcher.removeEventListener("transitionend", onEnd);
        // Re-anchor to the side at the dropped height (same pixels — no jump).
        launcher.style.transition = "transform 0.2s";
        applyFreeAnchor(horiz, targetY);
        settle();
      };
      const onEnd = (ev) => {
        if (ev.propertyName === "left" || ev.propertyName === "top") finalize();
      };
      launcher.addEventListener("transitionend", onEnd);
      fallback = setTimeout(finalize, SNAP_MS + 100);
      pendingFinalize = finalize;
    };

    launcher.addEventListener("pointerdown", (e) => {
      // Settle any in-flight drop animation now so its delayed finalize can't
      // re-anchor with stale coordinates during this new gesture.
      if (pendingFinalize) pendingFinalize();
      // Reset any stale suppress-flag so a prior drag can't swallow this tap.
      justDragged = false;
      pointerDown = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = launcher.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      try {
        launcher.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
    });

    launcher.addEventListener("pointermove", (e) => {
      if (!dragging) {
        // Not yet dragging — start the moment the pointer moves past the
        // threshold while pressed (no hold needed).
        if (
          pointerDown &&
          (Math.abs(e.clientX - startX) > DRAG_THRESHOLD ||
            Math.abs(e.clientY - startY) > DRAG_THRESHOLD)
        ) {
          lift();
        } else {
          return;
        }
      }
      launcher.style.transition = "none"; // 1:1 follow while dragging
      clearPlacement(launcher);
      const x = Math.max(
        0,
        Math.min(e.clientX - offsetX, window.innerWidth - LAUNCHER_SIZE),
      );
      const y = Math.max(
        0,
        Math.min(e.clientY - offsetY, window.innerHeight - LAUNCHER_SIZE),
      );
      launcher.style.left = x + "px";
      launcher.style.top = y + "px";
    });

    const endPointer = (e, canceled) => {
      pointerDown = false;
      try {
        launcher.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      if (dragging) {
        dragging = false;
        justDragged = true; // swallow the click that follows a drag
        if (canceled) {
          // Interrupted — re-anchor to the configured preset, no animation.
          launcher.style.transition = "transform 0.2s";
          applyPreset();
          settle();
        } else {
          snapToAnchor();
        }
      }
      // A plain press with no movement falls through: launcher.onclick opens
      // the chat as usual.
    };

    launcher.addEventListener("pointerup", (e) => endPointer(e, false));
    launcher.addEventListener("pointercancel", (e) => endPointer(e, true));
  }

  // --- Turnstile (invisible bot check) ---
  let turnstileScriptPromise = null;
  let turnstileWidgetId = null;
  let turnstileContainer = null;

  function loadTurnstileScript() {
    if (!turnstileSiteKey) return Promise.resolve(false);
    if (turnstileScriptPromise) return turnstileScriptPromise;

    turnstileScriptPromise = new Promise((resolve) => {
      if (window.turnstile) return resolve(true);
      const s = document.createElement("script");
      s.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
    return turnstileScriptPromise;
  }

  // Shared resolver so Turnstile's render-time callbacks always settle the
  // currently pending getTurnstileToken() promise (render binds the callback
  // once, but reset() re-fires it on later refreshes).
  let turnstileResolve = null;
  function settleTurnstile(value) {
    if (turnstileResolve) {
      const resolve = turnstileResolve;
      turnstileResolve = null;
      resolve(value);
    }
  }

  // Lock/unlock the composer. Used to block sending while an interactive
  // Turnstile challenge is on screen and unsolved.
  function setComposerEnabled(enabled) {
    chatInput.disabled = !enabled;
    sendChat.disabled = !enabled;
    sendChat.style.opacity = enabled ? "1" : "0.5";
    sendChat.style.cursor = enabled ? "pointer" : "not-allowed";
    chatInput.placeholder = enabled
      ? "Write your message..."
      : "Verify to continue…";
  }

  // Tear the widget down so it disappears from the chat after it's done (a fresh
  // one is rendered next time a token is needed).
  function cleanupTurnstile() {
    try {
      if (turnstileWidgetId !== null && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId);
      }
    } catch {
      /* ignore */
    }
    turnstileWidgetId = null;
    if (turnstileContainer) {
      turnstileContainer.remove();
      turnstileContainer = null;
    }
  }

  // Resolve to a one-time Turnstile token, or null if Turnstile is unavailable.
  async function getTurnstileToken() {
    if (!turnstileSiteKey) return null;
    const ok = await loadTurnstileScript();
    if (!ok || !window.turnstile) return null;

    if (!turnstileContainer) {
      turnstileContainer = document.createElement("div");
      // Rendered inside the chat window so that IF a challenge is shown (only
      // for suspicious visitors), it appears in the conversation flow. In the
      // normal "interaction-only" case it stays collapsed and takes no space.
      Object.assign(turnstileContainer.style, {
        display: "flex",
        justifyContent: "center",
        margin: "4px 0",
      });
      chatMessages.appendChild(turnstileContainer);
    }
    scrollToBottom();

    return new Promise((resolve) => {
      turnstileResolve = resolve;
      // Safety net: never hang the chat if Turnstile goes silent.
      setTimeout(() => {
        setComposerEnabled(true);
        settleTurnstile(null);
      }, 15000);
      try {
        turnstileWidgetId = window.turnstile.render(turnstileContainer, {
          sitekey: turnstileSiteKey,
          appearance: "interaction-only",
          // Lock the composer only when an interactive challenge actually shows.
          "before-interactive-callback": () => setComposerEnabled(false),
          callback: (token) => {
            setComposerEnabled(true);
            settleTurnstile(token);
          },
          "error-callback": () => {
            setComposerEnabled(true);
            settleTurnstile(null);
          },
          "timeout-callback": () => {
            setComposerEnabled(true);
            settleTurnstile(null);
          },
        });
      } catch {
        setComposerEnabled(true);
        settleTurnstile(null);
      }
    }).then((token) => {
      // On success, let the "Success ✓" state stay visible briefly, then remove
      // it. On failure, remove immediately.
      if (token) {
        setTimeout(cleanupTurnstile, 1500);
      } else {
        cleanupTurnstile();
      }
      return token;
    });
  }

  // Obtain (or refresh) a backend session token. Returns true on success.
  // De-duplicated: concurrent calls (e.g. pre-warm on open + first send) share
  // one in-flight request so we never run two Turnstile challenges at once.
  let sessionPromise = null;
  async function ensureSession() {
    if (sessionToken) return true;
    if (sessionPromise) return sessionPromise;

    sessionPromise = (async () => {
      const turnstileToken = await getTurnstileToken();
      try {
        const res = await fetch(`${apiUrl}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assistantId, turnstileToken }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.sessionToken) {
          return false;
        }
        sessionToken = data.sessionToken;
        return true;
      } catch {
        return false;
      } finally {
        sessionPromise = null;
      }
    })();

    return sessionPromise;
  }

  // --- Streaming bot bubble helpers ---
  const botBubbleStyle = {
    background: botColor,
    color: botTextColor,
    padding: "15px 14px",
    borderRadius: "12px 12px 12px 0px",
    maxWidth: "85%",
    alignSelf: "flex-start",
    wordWrap: "break-word",
    fontFamily: "Poppins",
    fontSize: "14px",
  };

  function createStreamingBubble() {
    const el = document.createElement("div");
    Object.assign(el.style, botBubbleStyle);
    el.className = "edw-typing-indicator edw-message-animate";
    el.innerHTML = `Thinking <span></span><span></span><span></span>`;
    chatMessages.appendChild(el);
    scrollToBottom();
    return el;
  }

  // Show a live status (Thinking / Typing) with the animated dots.
  function setBubbleStatus(el, label) {
    el.className = "edw-typing-indicator edw-message-animate";
    Object.assign(el.style, botBubbleStyle);
    el.innerHTML = `${label} <span></span><span></span><span></span>`;
    scrollToBottom();
  }

  // Switch the bubble to rendered message content (or an error).
  function setBubbleContent(el, text, isError) {
    el.className = "edw-message-animate";
    Object.assign(el.style, botBubbleStyle);
    if (isError) {
      el.style.background = "#D32F2F";
      el.style.color = "#fff";
      el.innerHTML = `<div class="edw-bot-content">${text}</div>`;
    } else {
      const cleaned = text.replace(/【[^】]*】/g, ""); // strip citation markers
      el.innerHTML = `<div class="edw-bot-content">${parseMarkdown(cleaned)}</div>`;
    }
    scrollToBottom();
  }

  // Open an SSE stream for a message and dispatch events to the handlers.
  // Transparently refreshes the session once on 401.
  async function streamChat(text, handlers, isRetry = false) {
    const ok = await ensureSession();
    if (!ok) {
      handlers.onError("Could not start a secure session.");
      return;
    }

    let res;
    try {
      res = await fetch(`${apiUrl}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          action: "sendMessage",
          assistantId,
          threadId,
          message: text,
        }),
      });
    } catch {
      handlers.onError("Connection error. Please try again.");
      return;
    }

    if (res.status === 401 && !isRetry) {
      sessionToken = null;
      return streamChat(text, handlers, true);
    }

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => null);
      handlers.onError(
        (data && data.error && data.error.message) ||
          `Request failed (${res.status}).`
      );
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const dataLine = chunk
          .split("\n")
          .find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        let evt;
        try {
          evt = JSON.parse(dataLine.slice(5).trim());
        } catch {
          continue;
        }
        if (evt.type === "status") handlers.onStatus(evt.status);
        else if (evt.type === "thread") handlers.onThread(evt.threadId);
        else if (evt.type === "delta") handlers.onDelta(evt.text);
        else if (evt.type === "error") handlers.onError(evt.message);
        // "done" is implied by the stream closing
      }
    }
  }

  // Messages typed while the bot is replying are queued and sent in order.
  const messageQueue = [];

  function appendUserMessage(text) {
    const userMsg = document.createElement("div");
    userMsg.className = "edw-message-animate";
    Object.assign(userMsg.style, {
      alignSelf: "flex-end",
      background: userColor,
      color: userTextColor,
      padding: "15px 14px",
      borderRadius: "12px 12px 0px 12px",
      maxWidth: "85%",
      wordWrap: "break-word",
      fontSize: "14px",
    });
    userMsg.innerText = text;
    chatMessages.appendChild(userMsg);
    scrollToBottom();
    return userMsg;
  }

  function appendQueueTag() {
    const tag = document.createElement("div");
    tag.className = "edw-queue-tag edw-message-animate";
    tag.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 7.5V12l3 1.8"></path>
      </svg>
      <span>Waiting to send…</span>
    `;
    chatMessages.appendChild(tag);
    scrollToBottom();
    return tag;
  }

  // Render the message immediately; queue it if the bot is mid-reply.
  function submitText(text) {
    if (!text) return;
    const item = { text, tag: null };
    appendUserMessage(text);
    if (isWaitingForResponse) {
      item.tag = appendQueueTag();
      messageQueue.push(item);
    } else {
      processItem(item);
    }
  }

  async function processItem(item) {
    isWaitingForResponse = true;
    if (item.tag) {
      item.tag.remove(); // it's its turn now — drop the "In queue…" tag
      item.tag = null;
    }

    // The bubble is created now (above any later-queued message) and mutated in
    // place: status dots → live text as it streams in.
    const bubble = createStreamingBubble();
    let accumulated = "";
    let started = false; // has any text arrived yet?
    let errored = false;

    try {
      await streamChat(item.text, {
        onStatus: (status) => {
          if (!started) {
            setBubbleStatus(bubble, status === "typing" ? "Typing" : "Thinking");
          }
        },
        onThread: (tid) => {
          if (tid) threadId = tid;
        },
        onDelta: (text) => {
          started = true;
          accumulated += text;
          setBubbleContent(bubble, accumulated, false);
        },
        onError: (msg) => {
          errored = true;
          setBubbleContent(
            bubble,
            msg || "Something went wrong. Please try again.",
            true
          );
        },
      });

      if (!started && !errored) {
        setBubbleContent(bubble, "No response received. Please try again.", true);
      }
    } catch (err) {
      if (!started) {
        setBubbleContent(bubble, "Connection error. Please try again.", true);
      }
    } finally {
      isWaitingForResponse = false;
      chatInput.focus();
      // Send the next queued message, if any.
      if (messageQueue.length > 0) {
        processItem(messageQueue.shift());
      }
    }
  }

  sendChat.onclick = () => {
    const text = chatInput.value.trim();
    if (!text) return;
    // Allow only ONE message to wait in the queue. If one is already waiting,
    // do nothing and keep the typed text so it isn't lost.
    if (isWaitingForResponse && messageQueue.length >= 1) return;
    chatInput.value = "";
    submitText(text);
  };

  chatInput.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChat.click();
    }
  };

  appendBotMessage("Hi! How can I help you today?");
})();
