'use strict';
const chapters = [
  {name:'第一章 · 极限', theme:'动中取静', verse:'任千流奔涌，守一潭澄明。', image:'limits'},
  {name:'第二章 · 导数', theme:'投桃报李', verse:'一枝春意动，万物有回声。', image:'derivatives'},
  {name:'第三章 · 积分', theme:'聚沙成丘', verse:'拾微尘万点，成山海千重。', image:'integrals'},
  {name:'第四章 · 应用', theme:'未竟', verse:'山门之外，尚有万重山。', image:'applications'}
];
const dialog = document.querySelector('#chapter-dialog');
document.querySelectorAll('[data-chapter]').forEach(button => {
  button.addEventListener('click', () => {
    const chapter = chapters[Number(button.dataset.chapter)];
    document.querySelector('#dialog-chapter').textContent = chapter.name;
    document.querySelector('#dialog-title').textContent = chapter.theme;
    document.querySelector('#dialog-verse').textContent = chapter.verse;
    document.querySelector('#dialog-art').src = `assets/home/${chapter.image}.png`;
    dialog.showModal();
  });
});
document.querySelectorAll('.dialog-close,.dialog-return').forEach(button => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
