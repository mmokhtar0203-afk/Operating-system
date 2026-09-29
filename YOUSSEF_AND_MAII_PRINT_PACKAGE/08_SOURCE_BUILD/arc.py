import numpy as np
def arc_path(cx,cy,r,w,a0,a1,n=None):
    """Filled outline of a circular stroke from angle a0 to a1 (deg, screen coords, increasing = clockwise), butt caps. Uses cubic beziers."""
    def seg(rr,s,e):
        out=[]; k=int(np.ceil(abs(e-s)/45)); 
        for i in range(k):
            t0=np.radians(s+(e-s)*i/k); t1=np.radians(s+(e-s)*(i+1)/k)
            h=4/3*np.tan((t1-t0)/4)
            p0=(cx+rr*np.cos(t0),cy+rr*np.sin(t0)); p3=(cx+rr*np.cos(t1),cy+rr*np.sin(t1))
            p1=(p0[0]-h*rr*np.sin(t0),p0[1]+h*rr*np.cos(t0)); p2=(p3[0]+h*rr*np.sin(t1),p3[1]-h*rr*np.cos(t1))
            out.append('C %.3f %.3f %.3f %.3f %.3f %.3f'%(*p1,*p2,*p3))
        return out
    ro,ri=r+w/2,r-w/2
    t=np.radians(a0)
    d=['M %.3f %.3f'%(cx+ro*np.cos(t),cy+ro*np.sin(t))]+seg(ro,a0,a1)
    t=np.radians(a1); d.append('L %.3f %.3f'%(cx+ri*np.cos(t),cy+ri*np.sin(t)))
    d+=seg(ri,a1,a0); d.append('Z')
    return ' '.join(d)
