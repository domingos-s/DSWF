// Preserve user-entered paragraph and line breaks in relationship changes and implementation journals.
(function preserveRelationshipChangeWhitespace(){
  const style=document.createElement('style');
  style.textContent=`
    .relationship-change-copy p,
    .change-context p,
    .change-journal-row p {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `;
  document.head.appendChild(style);
})();
