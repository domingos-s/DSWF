// Ensure the positive-recognition modal always appears above an open relationship profile.
const recognitionLayerStyle = document.createElement('style');
recognitionLayerStyle.textContent = `
#recognitionModal,
.positive-modal-backdrop{
  z-index:10050 !important;
}
#recognitionModal .positive-recognition-modal,
.positive-modal-backdrop .positive-recognition-modal{
  position:relative;
  z-index:10051 !important;
}
`;
document.head.appendChild(recognitionLayerStyle);
