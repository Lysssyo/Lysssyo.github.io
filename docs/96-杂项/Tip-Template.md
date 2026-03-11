<%*
const selection = tp.file.selection();
// 如果没选文字，直接插入空的 TIP
if (!selection) {
    tR += "> [!TIP]\n> ";
} else {
    // 将选中内容按行切分，每行前面补 > 
    const quotedText = selection.split('\n').map(line => '> ' + line).join('\n');
    tR += `> [!TIP]\n${quotedText}`;
}
%>