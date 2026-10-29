import struct, math
import os; os.chdir(os.path.dirname(os.path.abspath(__file__)))
def cube(s=20):
    v=[(0,0,0),(s,0,0),(s,s,0),(0,s,0),(0,0,s),(s,0,s),(s,s,s),(0,s,s)]
    f=[(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),(1,2,6),(1,6,5),(2,3,7),(2,7,6),(3,0,4),(3,4,7)]
    return [[v[a],v[b],v[c]] for a,b,c in f]
def write_bin(path,tris,hdr=b"Testwuerfel 20mm"):
    with open(path,"wb") as fh:
        fh.write(hdr.ljust(80,b"\0")); fh.write(struct.pack("<I",len(tris)))
        for t in tris: fh.write(struct.pack("<12fH",0,0,0,*t[0],*t[1],*t[2],0))
def write_ascii(path,tris):
    with open(path,"w") as fh:
        fh.write("solid asciiwuerfel\n")
        for t in tris:
            fh.write(" facet normal 0 0 0\n  outer loop\n")
            for p in t: fh.write("   vertex %g %g %g\n"%p)
            fh.write("  endloop\n endfacet\n")
        fh.write("endsolid asciiwuerfel\n")
c=cube(); write_bin("cube20.stl",c); write_ascii("cube_ascii.stl",c); write_bin("open.stl",c[:-2],b"offen")
# grosser Zylinder 300mm hoch (passt nicht)
tris=[]; n=64; r=30; h=300
for i in range(n):
    a=2*math.pi*i/n; b=2*math.pi*(i+1)/n
    p0=(r*math.cos(a),r*math.sin(a)); p1=(r*math.cos(b),r*math.sin(b))
    tris+= [[(0,0,0),(p1[0],p1[1],0),(p0[0],p0[1],0)],[(0,0,h),(p0[0],p0[1],h),(p1[0],p1[1],h)],
            [(p0[0],p0[1],0),(p1[0],p1[1],0),(p1[0],p1[1],h)],[(p0[0],p0[1],0),(p1[0],p1[1],h),(p0[0],p0[1],h)]]
write_bin("tall.stl",tris)
open("cube.obj","w").write("v 0 0 0\nv 10 0 0\nv 10 10 0\nv 0 10 0\nv 0 0 10\nv 10 0 10\nv 10 10 10\nv 0 10 10\nf 1 3 2\nf 1 4 3\nf 5 6 7 8\nf 1 2 6 5\nf 2 3 7 6\nf 3 4 8 7\nf 4 1 5 8\n")
open("garbage.stl","wb").write(b"\x89PNG not an stl"*20)

# ---------- 3MF ----------
import zipfile
CT = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'
RELS = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'
def mesh_xml(s=20):
    v=[(0,0,0),(s,0,0),(s,s,0),(0,s,0),(0,0,s),(s,0,s),(s,s,s),(0,s,s)]
    f=[(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),(1,2,6),(1,6,5),(2,3,7),(2,7,6),(3,0,4),(3,4,7)]
    return '<mesh><vertices>'+''.join(f'<vertex x="{a}" y="{b}" z="{c}"/>' for a,b,c in v)+'</vertices><triangles>'+''.join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a,b,c in f)+'</triangles></mesh>'
NS='xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"'
def write3mf(path, files, comp=zipfile.ZIP_DEFLATED):
    with zipfile.ZipFile(path,'w',comp) as z:
        z.writestr('[Content_Types].xml',CT); z.writestr('_rels/.rels',RELS)
        for n,c in files.items(): z.writestr(n,c)
write3mf('cube.3mf',{'3D/3dmodel.model':f'<?xml version="1.0"?><model unit="millimeter" {NS}><metadata name="Application">PrusaSlicer-2.8</metadata><resources><object id="1" type="model">{mesh_xml()}</object></resources><build><item objectid="1" transform="1 0 0 0 1 0 0 0 1 128 128 0"/></build></model>'})
# Bambu-Stil: Unterbaugruppe in eigener Datei, zwei Kopien auf der Platte
write3mf('bambu.3mf',{
 '3D/3dmodel.model':f'<?xml version="1.0"?><model unit="millimeter" {NS} xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p"><metadata name="Application">BambuStudio-02.03</metadata><resources><object id="2" p:UUID="x" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/></components></object></resources><build><item objectid="2" transform="1 0 0 0 1 0 0 0 1 100 128 0" printable="1"/><item objectid="2" transform="0 1 0 -1 0 0 0 0 1 150 128 0" printable="1"/></build></model>',
 '3D/Objects/object_1.model':f'<?xml version="1.0"?><model unit="millimeter" {NS}><resources><object id="1" type="model">{mesh_xml()}</object></resources><build/></model>'})
write3mf('inch.3mf',{'3D/3dmodel.model':f'<model unit="inch" {NS}><resources><object id="1">{mesh_xml(1)}</object></resources><build><item objectid="1"/></build></model>'}, zipfile.ZIP_STORED)
with zipfile.ZipFile('sliced.3mf','w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml',CT); z.writestr('Metadata/plate_1.gcode',';gcode')

# ---------- PLY ----------
V=[(0,0,0),(10,0,0),(10,10,0),(0,10,0),(0,0,10),(10,0,10),(10,10,10),(0,10,10)]
Q=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
with open('cube_ascii.ply','w') as f:
    f.write('ply\nformat ascii 1.0\ncomment Scanner-Test\nelement vertex 8\nproperty float x\nproperty float y\nproperty float z\nelement face 6\nproperty list uchar int vertex_indices\nend_header\n')
    for v in V: f.write('%g %g %g\n'%v)
    for q in Q: f.write('4 %d %d %d %d\n'%q)
def binply(path, endian):
    e='<' if endian=='little' else '>'
    hdr=(f'ply\nformat binary_{endian}_endian 1.0\nelement vertex 8\nproperty float x\nproperty float y\nproperty float z\nproperty float nx\nproperty float ny\nproperty float nz\nproperty uchar red\nproperty uchar green\nproperty uchar blue\n'
         'element face 12\nproperty list uchar int vertex_indices\nproperty uchar flags\nelement edge 1\nproperty int vertex1\nproperty int vertex2\nend_header\n').encode()
    body=b''.join(struct.pack(e+'6f3B',*v,0,0,1,255,0,0) for v in V)
    for q in Q: body+=struct.pack(e+'B3iB',3,q[0],q[1],q[2],0)+struct.pack(e+'B3iB',3,q[0],q[2],q[3],0)
    body+=struct.pack(e+'2i',0,1)
    open(path,'wb').write(hdr+body)
binply('cube_le.ply','little'); binply('cube_be.ply','big')
open('cloud.ply','w').write('ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n1 0 0\n0 1 0\n')
