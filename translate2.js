const fs = require('fs');
let html = fs.readFileSync('docs/02_UI_Screens/PITCH_DECK_SLIDE.html', 'utf-8');

html = html.replace(/<div class="label label-purple">Social Impact\s+임팩트<\/div>/g, '<div class="label label-purple">Social Impact</div>');
html = html.replace(/<div class="label label-blue">Strategic Advantage\s+이점<\/div>/g, '<div class="label label-blue">Strategic Advantage</div>');
html = html.replace(/<div class="label label-amber">Organic Demand\s+수요<\/div>/g, '<div class="label label-amber">Organic Demand</div>');
html = html.replace(/<div class="label label-green">Defensibility\s+우위<\/div>/g, '<div class="label label-green">Defensibility</div>');

html = html.replace(/<h3 style="font-family:var\(--font-kr\);font-size:22px;color:var\(--text-primary\);margin-bottom:16px;font-weight:800;">\s*거대한 잠재 수요\s*<\/h3>/, '<h3 style="font-size:22px;color:var(--text-primary);margin-bottom:16px;font-weight:800;">Massive Organic Demand</h3>');
html = html.replace(/<p style="font-family:var\(--font-kr\);font-size:16px;color:var\(--text-secondary\);line-height:1\.75;margin-bottom:16px;">\s*화려한 랜드마크보다 <strong style="color:var\(--accent-amber\);">\'주민과의 교감, 나만 아는 시골길\'<\/strong>이 킬러 콘텐츠로 부상하고 있습니다\.\s*<\/p>/, '<p style="font-size:16px;color:var(--text-secondary);line-height:1.75;margin-bottom:16px;">More than flashy landmarks, <strong style="color:var(--accent-amber);">\'connection with locals, secret rural paths\'</strong> are rising as killer contents.</p>');
html = html.replace(/<h1 style="font-size:42px;margin-bottom:20px;max-width:720px;">\s*한국에서 증명하고,<br \/>전 세계 지방 소멸의 해법이 되겠습니다\.\s*<\/h1>/, '<h1 style="font-size:42px;margin-bottom:20px;max-width:720px;">Proven in Korea.<br/>The Solution for Global Rural Decline.</h1>');

html = html.replace(/거대한 잠재 수요/g, 'Massive Organic Demand');
html = html.replace(/화려한 랜드마크보다 <strong style="color:var\(--accent-amber\);">\'주민과의 교감, 나만 아는 시골길\'<\/strong>이 킬러 콘텐츠로 부상하고 있습니다./g, 'More than flashy landmarks, <strong style="color:var(--accent-amber);">\'connection with locals, secret rural paths\'</strong> are rising as killer contents.');

fs.writeFileSync('docs/02_UI_Screens/PITCH_DECK_SLIDE.html', html);
console.log("Replaced final parts.");
