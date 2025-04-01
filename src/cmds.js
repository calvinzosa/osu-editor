// documentation to types

s='';$0.querySelectorAll('tr').forEach(tr=>s+=`/** ${tr.children[2].textContent} */\n${tr.children[0].children[0].textContent}: ${tr.children[1].textContent};\n`);console.log(s)
