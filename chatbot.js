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

  const headerTextColor = "#162149";
  const closeIconColor = "#E9E4FE";
  const dividerColor = "rgba(235, 227, 252, 1)";
  const inputBorderColor = primaryColor;

  let isWaitingForResponse = false;
  let threadId = null;
  let sessionToken = null;

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
    bottom: "20px",
    right: "20px",
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
  });

  launcher.onmouseenter = () => (launcher.style.transform = "scale(1.1)");
  launcher.onmouseleave = () => (launcher.style.transform = "scale(1)");
  document.body.appendChild(launcher);

  // --- Chat Window ---
  const chatWindow = document.createElement("div");
  chatWindow.id = "edw-chatWindow";
  Object.assign(chatWindow.style, {
    position: "fixed",
    bottom: "90px",
    right: "20px",
    width: "360px",
    height: "500px",
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
      color: isError ? "#fff" : "#000",
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
    color: "#000",
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
      color: "#000",
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
