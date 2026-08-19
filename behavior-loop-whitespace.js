// Preserve user-authored paragraph breaks in the behavioral-loop dashboard.
(function preserveBehaviorLoopWhitespace(){
  const style=document.createElement('style');
  style.textContent=`
    .loop-focus-row small {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `;
  document.head.append(style);
})();
