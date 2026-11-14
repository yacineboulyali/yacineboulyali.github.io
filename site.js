// Apparition des blocs au défilement et inclinaison du portrait (indépendant de Three.js).
document.documentElement.classList.add('js');
const items = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  items.forEach((el, i) => { el.style.transitionDelay = (i % 4) * 80 + 'ms'; io.observe(el); });
} else items.forEach((el) => el.classList.add('in'));

const card = document.querySelector('.portrait-card');
const fig = document.querySelector('.portrait');
if (card && fig && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  card.style.transition = 'transform .25s ease-out';
  fig.addEventListener('pointermove', (e) => {
    const r = fig.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(900px) rotateX(${(-y * 9).toFixed(2)}deg) rotateY(${(x * 11).toFixed(2)}deg)`;
  });
  fig.addEventListener('pointerleave', () => { card.style.transform = ''; });
}
