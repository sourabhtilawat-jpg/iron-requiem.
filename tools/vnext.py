import json,sys
d=json.load(open('voice_gen.json'))
if len(sys.argv)>2:d[sys.argv[1]]=sys.argv[2];json.dump(d,open('voice_gen.json','w'))
plan=json.load(open('voice_lines.json'))
URG={'m2_1','r2_1','k3_2','n3_3','m4_1','h5_2','r5_1','m6_1','r7_1','m7_1','k7_1','r8_1','k9_1','k10_4','x10_2','m_tank','vd2565035','v791f20b7','v18aed788','vca41b14f','veacf4823','vbc6b2743','vaca6c032','h8_1','h9_1','v8d731655','va4b0ffb7','v1c888bbc','vfb322080'}
todo=[p for p in plan if p[0] not in d]
print(len(d),'done;',len(todo),'left')
for p in todo[:3]:
    t=p[2]
    if p[0] in URG:t='[shouting] '+t
    if p[0]=='n3_1':t='[whispers] '+t
    if p[0]=='n7_1':t='[desperate, out of breath] '+t
    print(p[0],p[1],'|',t)
