import { Game } from './core/Game';

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();

  const startScreen = document.getElementById('start-screen');
  const startBtn = document.getElementById('start-btn');

  if (startBtn && startScreen) {
    startBtn.addEventListener('click', () => {
      startScreen.style.display = 'none';
      game.startCountdown();
    });
  }
});
