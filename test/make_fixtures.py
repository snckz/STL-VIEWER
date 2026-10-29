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
