(function() {
    const scriptTag = document.currentScript;
    const universityName = scriptTag.getAttribute("data-university-name") || "University Chatbot";
    const universityIcon = scriptTag.getAttribute("data-university-icon") || "🤖";
    const assistantId = scriptTag.getAttribute("data-assistant-id") || "test-assistant";

    const primaryColor = scriptTag.getAttribute("data-primary-color") || "rgb(76,154,227)";
    const userColor = scriptTag.getAttribute("data-user-color") || primaryColor;
    const botColor = scriptTag.getAttribute("data-bot-color") || primaryColor;

    let isWaitingForResponse = false;
    let threadId = null;

    const style = document.createElement('style');
    style.innerHTML = `
        .typing-indicator {
            display: flex;
            align-items: baseline;
            padding: 10px 14px !important;
        }
        .typing-indicator span {
            /* Dots are now smaller */
            height: 6px;
            width: 6px;
            margin: 0 2px;
            background-color: rgba(255, 255, 255, 0.7);
            border-radius: 50%;
            display: inline-block;
            animation: bounce 1.4s infinite ease-in-out both;
        }
        /* Re-add margin for spacing between "Typing" and dots */
        .typing-indicator span:first-of-type {
            margin-left: 6px;
        }
        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1.0); }
        }
    `;
    document.head.appendChild(style);


    const button = document.createElement("div");
    const botIcon = universityIcon || "🤖";

    if (botIcon.startsWith("http://") || botIcon.startsWith("https://")) {
        const img = document.createElement("img");
        img.src = botIcon;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        img.style.borderRadius = "50%";
        button.appendChild(img);
    } else {
        button.innerHTML = `<span style="font-size:28px;">${botIcon}</span>`;
    }

    Object.assign(button.style, {
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
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        transition: "transform 0.2s, box-shadow 0.2s",
        zIndex: 9999
    });

    button.onmouseenter = () => {
        button.style.transform = "scale(1.1)";
        button.style.boxShadow = "0 6px 18px rgba(0,0,0,0.35)";
    };
    button.onmouseleave = () => {
        button.style.transform = "scale(1)";
        button.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
    };
    document.body.appendChild(button);

    const chatWindow = document.createElement("div");
    Object.assign(chatWindow.style, {
        position: "fixed",
        bottom: "90px",
        right: "20px",
        width: "360px",
        height: "500px",
        background: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        display: "none",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        zIndex: 9999
    });

    chatWindow.innerHTML = `
        <div style="background:${primaryColor};color:white;padding:14px 16px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
            <span>${universityName}</span>
            <span id="closeChat" style="cursor:pointer;font-weight:bold;font-size:18px;">✖</span>
        </div>
        <div id="chatMessages" style="flex:1;padding:12px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;"></div>
        <div style="padding:12px;border-top:1px solid #ddd;display:flex;gap:6px;">
            <input id="chatInput" type="text" placeholder="Type a message..." style="flex:1;padding:10px;border-radius:20px;border:1px solid #ccc;outline:none;font-size:14px;transition: border 0.2s;"/>
            <button id="sendChat" style="width:48px;height:48px;border-radius:50%;background:${primaryColor};color:white;border:none;display:flex;justify-content:center;align-items:center;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.2);transition: all 0.2s;font-size:17px;line-height:1;padding:0;">
                &#10148;
            </button>
        </div>
    `;

    document.body.appendChild(chatWindow);

    const chatMessages = chatWindow.querySelector("#chatMessages");
    const chatInput = chatWindow.querySelector("#chatInput");
    const sendChat = chatWindow.querySelector("#sendChat");

    const scrollToBottom = () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const initialBotMsg = document.createElement("div");
    initialBotMsg.style.alignSelf = "flex-start";
    initialBotMsg.style.background = botColor;
    initialBotMsg.style.color = "#fff";
    initialBotMsg.style.padding = "10px 14px";
    initialBotMsg.style.borderRadius = "12px 12px 12px 0px";
    initialBotMsg.style.maxWidth = "80%";
    initialBotMsg.style.wordWrap = "break-word";
    initialBotMsg.innerHTML = `Hello! How can I help you today?`;
    chatMessages.appendChild(initialBotMsg);

    button.onclick = () => {
        chatWindow.style.display = chatWindow.style.display === "none" ? "flex" : "none";
        if (chatWindow.style.display === "flex") {
            chatInput.focus();
        }
    };
    chatWindow.querySelector("#closeChat").onclick = () => chatWindow.style.display = "none";

    const setSendButtonDisabled = (disabled) => {
        isWaitingForResponse = disabled;
        // Only disable the send button, not the input field
        sendChat.disabled = disabled;
        sendChat.style.opacity = disabled ? "0.6" : "1";
        sendChat.style.cursor = disabled ? "not-allowed" : "pointer";
    };

    async function sendMessage(text) {
        if (!text || isWaitingForResponse) return;

        setSendButtonDisabled(true);

        const userMsg = document.createElement("div");
        userMsg.style.alignSelf = "flex-end";
        userMsg.style.background = userColor;
        userMsg.style.color = "#fff";
        userMsg.style.padding = "10px 14px";
        userMsg.style.borderRadius = "12px 12px 0px 12px";
        userMsg.style.maxWidth = "80%";
        userMsg.style.wordWrap = "break-word";
        userMsg.innerHTML = `${text}`;
        chatMessages.appendChild(userMsg);
        scrollToBottom();

        const typing = document.createElement("div");
        typing.style.alignSelf = "flex-start";
        typing.style.background = botColor;
        typing.style.color = "#fff";
        typing.style.borderRadius = "12px 12px 12px 0px";
        typing.style.maxWidth = "fit-content";
        typing.classList.add('typing-indicator');
        // Restore "Typing" text
        typing.innerHTML = `Typing <span></span><span></span><span></span>`;
        chatMessages.appendChild(typing);
        scrollToBottom();

        try {
    const res = await fetch("https://eduway-chatbot-backend.onrender.com/chat", {

                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "sendMessage",
                    assistantId: assistantId,
                    threadId: threadId,
                    message: text
                })
            });
            
            if (!res.ok) {
                throw new Error(`Server responded with status: ${res.status}`);
            }

            const data = await res.json();
            threadId = data.threadId;

            typing.remove();

            const botMsg = document.createElement("div");
            botMsg.style.alignSelf = "flex-start";
            botMsg.style.background = botColor;
            botMsg.style.color = "#fff";
            botMsg.style.padding = "10px 14px";
            botMsg.style.borderRadius = "12px 12px 12px 0px";
            botMsg.style.maxWidth = "80%";
            botMsg.style.wordWrap = "break-word";
            botMsg.innerHTML = `${data.reply}`;
            chatMessages.appendChild(botMsg);
            scrollToBottom();

        } catch (err) {
            typing.remove();
            console.error("Chatbot Error:", err);
            
            const errorMsg = document.createElement("div");
            errorMsg.style.alignSelf = "flex-start";
            errorMsg.style.background = "#D32F2F";
            errorMsg.style.color = "#fff";
            errorMsg.style.padding = "10px 14px";
            errorMsg.style.borderRadius = "12px 12px 12px 0px";
            errorMsg.style.maxWidth = "80%";
            errorMsg.style.wordWrap = "break-word";
            errorMsg.innerHTML = "Sorry, I'm having trouble connecting. Please try again in a moment.";
            chatMessages.appendChild(errorMsg);
            scrollToBottom();

        } finally {
            setSendButtonDisabled(false);
            chatInput.focus();
        }
    }

    const handleSend = () => {
        const text = chatInput.value.trim();
        if (!text || isWaitingForResponse) return;
        chatInput.value = "";
        sendMessage(text);
    };

    sendChat.onclick = handleSend;
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
})();





