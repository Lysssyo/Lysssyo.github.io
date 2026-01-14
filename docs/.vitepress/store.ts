import { reactive } from 'vue'

export interface PrivateFile {
  name: string
  path: string // virtual path or relative path
  type: 'file' | 'dir'
  content?: string // mocked content
  children?: PrivateFile[]
}

export const privateStore = reactive({
  isUnlocked: false,
  token: '',
  fileList: [] as PrivateFile[], 
  currentDoc: null as PrivateFile | null,
  
  setData(files: PrivateFile[]) {
    this.fileList = files
    this.isUnlocked = true
  },
  
  setCurrentDoc(file: PrivateFile | null) {
    this.currentDoc = file
  }
})
