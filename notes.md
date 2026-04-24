


    // document.addEventListener("keydown", (e: KeyboardEvent) => {
    //     const currentRow = submittedGuesses.length;
    //     if (currentRow >= MAX_ROWS) return;

    //     if (e.key === "Backspace") {
    //         currentGuess = currentGuess.slice(0, -1);
    //         redraw();
    //         return;
    //     }

    //     if (e.key === "Enter") {
    //         if (currentGuess.length === MAX_COLS) {
    //             submittedGuesses.push(currentGuess);
    //             currentGuess = "";
    //             redraw();
    //         }
    //         return;
    //     }

    //     if (/^[a-zA-Z]$/.test(e.key) && currentGuess.length < MAX_COLS) {
    //         currentGuess += e.key.toUpperCase();
    //         redraw();
    //     }
    // });

    // // -------------------------------------------------------------------------
    // // Mouse events
    // // -------------------------------------------------------------------------

    // canvas.addEventListener("click", (e: MouseEvent) => {
    //     const rect = canvas.getBoundingClientRect();
    //     const scaleX = width / rect.width;
    //     const scaleY = height / rect.height;
    //     const x = (e.clientX - rect.left) * scaleX;
    //     const y = (e.clientY - rect.top) * scaleY;

    //     const col = Math.floor(x / gridSize);
    //     const row = Math.floor(y / gridSize);

    //     if (row >= 0 && row < MAX_ROWS && col >= 0 && col < MAX_COLS) {
    //         console.log(`Clicked cell row=${row} col=${col}`);
    //     }
    // });

