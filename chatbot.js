(function() {
    // --- Existing Configuration ---
    const scriptTag = document.currentScript;
    const universityName = scriptTag.getAttribute("data-university-name") || "My Bot";
    const universityIcon = scriptTag.getAttribute("data-university-icon") || "default"; 
    const assistantId = scriptTag.getAttribute("data-assistant-id") || "test-assistant";

    const primaryColor = scriptTag.getAttribute("data-primary-color") || "rgb(76,154,227)";
    const userColor = scriptTag.getAttribute("data-user-color") || "rgb(230, 230, 230)"; 
    const botColor = scriptTag.getAttribute("data-bot-color") || "rgb(240, 240, 240)"; 
    
    // --- New Design Colors ---
    const headerTextColor = "#162149";
    const closeIconColor = "#E9E4FE";
    const dividerColor = "rgba(235, 227, 252, 1)";
    const inputBorderColor = primaryColor; 

    let isWaitingForResponse = false;
    let threadId = null;

    // --- Import Poppins Font ---
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // --- Base Styles ---
    const style = document.createElement('style');
    style.innerHTML = `
        .typing-indicator {
            display: flex;
            align-items: baseline;
            padding: 15px 14px !important;
        }
        .typing-indicator span {
            height: 6px;
            width: 6px;
            margin: 0 2px;
            background-color: rgba(0, 0, 0, 0.4);
            border-radius: 50%;
            display: inline-block;
            animation: bounce 1.4s infinite ease-in-out both;
        }
        .typing-indicator span:first-of-type {
            margin-left: 6px;
        }
        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1.0); }
        }
        
        /* New Chat Input Style */
        #chatInput::placeholder {
            color: #ccc;
        }
        #chatInput:focus {
            border-width: 2px;
            padding: 9px 15px; 
        }
    `;
    document.head.appendChild(style);

    // --- Chat Bubble (Launcher Button) ---
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
         button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.77 2.9CF.079 16.01 0 16.01 0 16.01s.99.104 1.907-.837C2.932 14.5 4.178 15 5.283 15h2.717zM5 8h1.5v1.5H5V8zm2.5 0h1.5v1.5H7.5V8zm2.5 0h1.5v1.5H10V8z"/></svg>`;
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
        boxShadow: "none", // CHANGED: Removed shadow
        transition: "transform 0.2s", // CHANGED: Removed box-shadow transition
        zIndex: 9999,
        border: "1px solid #e0e0e0" // OPTIONAL: Added thin border so button is visible on white backgrounds
    });

    button.onmouseenter = () => {
        button.style.transform = "scale(1.1)";
        // CHANGED: Removed shadow on hover
    };
    button.onmouseleave = () => {
        button.style.transform = "scale(1)";
        // CHANGED: Removed shadow on hover leave
    };
    document.body.appendChild(button);

    // --- Chat Window ---
    const chatWindow = document.createElement("div");
    Object.assign(chatWindow.style, {
        position: "fixed",
        bottom: "90px",
        right: "20px",
        width: "360px",
        height: "500px",
        background: "#ffffff",
        borderRadius: "16px",
        boxShadow: "none", // CHANGED: Removed shadow/glow
        border: "1px solid #e0e0e0", // OPTIONAL: Added thin border for visibility
        display: "none",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Poppins', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        zIndex: 9999
    });

    // Helper function to create the header avatar
    function createHeaderAvatar() {
        const avatarContainer = document.createElement("div");
        Object.assign(avatarContainer.style, {
            width: "56px",
            height: "56px",
            minWidth: "56px",
            borderRadius: "50%",
            backgroundColor: "#f0f0f0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden"
        });

        if (universityIcon.startsWith("http")) {
            const img = document.createElement("img");
            img.src = universityIcon;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            avatarContainer.appendChild(img);
        } else {
            avatarContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="#999" viewBox="0 0 16 16"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z"/></svg>`;
        }
        return avatarContainer;
    }

    // --- Define Close Icon SVG ---
    const closeIconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13" stroke="${closeIconColor}" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M13 1L1 13" stroke="${closeIconColor}" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
    `;

    chatWindow.innerHTML = `
        <div style="padding:16px; background: #fff; display:flex; flex-direction:column; gap: 4px;">
            <div style="display:flex; align-items:center; gap: 12px;">
                ${createHeaderAvatar().outerHTML}
                <span style="font-weight:bold; color:${headerTextColor}; font-size:16px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${universityName}
                </span>

                <span id="closeChat" style="cursor:pointer; display:flex; align-items:center; justify-content:center; width:24px; height:24px;">
                    ${closeIconSvg}
                </span>
            </div>
            <div style="height:1px; background:${dividerColor}; margin-top: 12px;"></div>
        </div>
        
        <div id="chatMessages" style="flex:1; padding:16px; overflow-y:auto; display:flex; flex-direction:column; gap:12px;">
        </div>
        
        <div style="padding: 0 16px 16px 16px; background: #fff;">
            <div style="height:1px; background:${dividerColor}; margin-bottom: 16px;"></div>
            <div style="display:flex; align-items:center; gap:8px;">
                <input id="chatInput" type="text" placeholder="Write your message..." style="flex:1; height:48px; padding:10px 16px; border-radius:12px; border: 1.5px solid ${inputBorderColor}; outline:none; font-size:14px; font-family: 'Poppins'; box-sizing: border-box; transition: all 0.2s;" />
                <button id="sendChat" style="
                    width:36px; 
                    height:36px; 
                    min-width:36px; 
                    border-radius:50%; 
                    background:${primaryColor}; 
                    color:white; 
                    border:none; 
                    display:flex; 
                    justify-content:center; 
                    align-items:center; 
                    cursor:pointer; 
                    transition: all 0.2s;
                ">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2v7z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(chatWindow);

    // --- Re-query Elements ---
    const chatMessages = chatWindow.querySelector("#chatMessages");
    const chatInput = chatWindow.querySelector("#chatInput");
    const sendChat = chatWindow.querySelector("#sendChat");
    const closeChatBtn = chatWindow.querySelector("#closeChat"); 

    // --- Chat Logic ---
    const scrollToBottom = () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // Helper to create the small message avatar
    function createBotAvatar() {
        const avatar = document.createElement("div");
        Object.assign(avatar.style, {
            width: "32px",
            height: "32px",
            minWidth: "32px",
            borderRadius: "50%",
            backgroundColor: "#f0f0f0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden"
        });

        if (universityIcon.startsWith("http")) {
            const img = document.createElement("img");
            img.src = universityIcon;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            avatar.appendChild(img);
        } else {
            avatar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="${primaryColor}" viewBox="0 0 16 16"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z"/></svg>`;
        }
        return avatar;
    }

    // Helper to append a bot message
    function appendBotMessage(htmlContent, isError = false) {
        const msgWrapper = document.createElement("div");
        Object.assign(msgWrapper.style, {
            display: "flex",
            alignItems: "flex-end",
            gap: "9px",
            alignSelf: "flex-start",
            fontSize: "14px",
            fontFamily: "Poppins"
        });

        msgWrapper.appendChild(createBotAvatar());

        const botMsg = document.createElement("div");
        Object.assign(botMsg.style, {
            background: isError ? "#D32F2F" : botColor,
            color: isError ? "#fff" : "#000", 
            padding: "15px 14px",
            borderRadius: "12px 12px 12px 0px", 
            maxWidth: "80%",
            wordWrap: "break-word",
            fontFamily: "Poppins",
            fontSize: "14px"
        });
        
        botMsg.innerHTML = htmlContent;
        
        if (htmlContent.includes("typing-indicator")) {
             botMsg.classList.add('typing-indicator');
             botMsg.innerHTML = `Typing <span></span><span></span><span></span>`;
        }
        
        msgWrapper.appendChild(botMsg);
        chatMessages.appendChild(msgWrapper);
        scrollToBottom();
        
        return botMsg; 
    }

    // --- Initial Bot Message ---
    appendBotMessage("Hi! How can I help you today?");

    // --- Event Listeners ---
    button.onclick = () => {
        chatWindow.style.display = chatWindow.style.display === "none" ? "flex" : "none";
        if (chatWindow.style.display === "flex") {
            chatInput.focus();
        }
    };
    closeChatBtn.onclick = () => chatWindow.style.display = "none"; 

    const setSendButtonDisabled = (disabled) => {
        isWaitingForResponse = disabled;
        sendChat.disabled = disabled;
        sendChat.style.opacity = disabled ? "0.6" : "1";
        sendChat.style.cursor = disabled ? "not-allowed" : "pointer";
    };

    async function sendMessage(text) {
        if (!text || isWaitingForResponse) return;

        setSendButtonDisabled(true);

        // --- User Message ---
        const userMsg = document.createElement("div");
        Object.assign(userMsg.style, {
            alignSelf: "flex-end",
            background: userColor,
            color: "#000", 
            padding: "15px 14px", 
            borderRadius: "12px 12px 0px 12px",
            maxWidth: "80%",
            wordWrap: "break-word",
            fontFamily: "'Poppins', sans-serif",
            fontSize: "14px"
        });
        userMsg.innerHTML = `${text}`; 
        chatMessages.appendChild(userMsg);
        scrollToBottom();

        // --- Typing Indicator ---
        const typing = appendBotMessage('typing-indicator');

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

            typing.parentElement.remove(); 

            // --- Bot Reply ---
            appendBotMessage(data.reply);

        } catch (err) {
            typing.parentElement.remove(); 
            console.error("Chatbot Error:", err);
            
            // --- Error Message ---
            appendBotMessage("Sorry, I'm having trouble connecting. Please try again in a moment.", true);

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
