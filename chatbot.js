// --- Helper: Generate Clean Avatar HTML with Classy Fallback ---
    const getAvatarHTML = (size) => {
        const sizePx = typeof size === 'number' ? `${size}px` : size;
        
        // A classy graduation cap icon (SVG) colored with your primary brand color
        // This sits in the background. If the image loads, it covers this. 
        // If the image fails or doesn't exist, this shows.
        const fallbackIcon = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${primaryColor}" width="55%" height="55%">
                <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" />
            </svg>
        `;

        // Logic: 
        // 1. Create a container.
        // 2. Put the SVG inside (centered).
        // 3. If a URL exists, put the IMG tag absolute positioned ON TOP.
        // 4. On IMG error, hide the IMG, revealing the SVG underneath.
        
        let imgTag = "";
        if (universityIcon.startsWith("http")) {
            imgTag = `
                <img src="${universityIcon}" 
                     style="
                        position: absolute; 
                        top: 0; 
                        left: 0; 
                        width: 100%; 
                        height: 100%; 
                        object-fit: cover; 
                        border-radius: 50%;
                        background: #fff; /* White bg behind image prevents transparency issues */
                     " 
                     onerror="this.style.display='none'" 
                     alt="Bot Avatar">
            `;
        }

        return `
            <div style="
                width:${sizePx}; 
                height:${sizePx}; 
                min-width:${sizePx}; 
                border-radius:50%; 
                overflow:hidden; 
                background:#f0f0f0; 
                display:flex; 
                align-items:center; 
                justify-content:center; 
                position: relative; /* Needed for absolute positioning of image */
            ">
                ${fallbackIcon}
                ${imgTag}
            </div>
        `;
    };
