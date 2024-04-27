onmessage = function(e) {
    console.log('Message received from main script');
    const blobs = Array.from({ length: 10 }, (_, id) => {
        const angle = Math.random() * 2 * Math.PI; // Random angle in radians
        const speed = 0.2 + 0.2*Math.random();
        return {
            id,
            x: Math.random() * 100,
            y: Math.random() * 100,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed
        };
    });

    function updatePositions() {
        blobs.forEach(blob => {
            blob.x += blob.dx;
            blob.y += blob.dy;

            // Reverse direction on boundary collision
            if (blob.x > 100 || blob.x < 0) blob.dx *= -1;
            if (blob.y > 100 || blob.y < 0) blob.dy *= -1;
        });

        postMessage(blobs);
        setTimeout(updatePositions, 1000 / 60); // update at ~60 fps
    }

    updatePositions();
};