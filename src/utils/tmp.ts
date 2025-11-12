
import os from 'os'
import path from 'path'
import fs from 'fs'

export function ensureDir(p:string) {
    fs.mkdirSync(p, { recursive: true });
}

export function tmpSubdir(name:string) {
    const dir = path.join(os.tmpdir(),'streamsphere',name);
    ensureDir(dir)
    return dir
}