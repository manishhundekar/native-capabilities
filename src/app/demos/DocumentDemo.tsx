'use client';

import '@/lib/types';
import { callNativeBridge } from '@/lib/types';

import { useState, useRef } from 'react';
import { Stepper, Card, Button, StatusBadge, CodeBlock, Result } from '@/components';

const steps = [
  { id: 'compare', title: 'Compare', description: 'Pros & cons of each mode' },
  { id: 'check', title: 'Check Support', description: 'Verify file picker API' },
  { id: 'config', title: 'Configure', description: 'Set file types & options' },
  { id: 'select', title: 'Select Files', description: 'Open file picker' },
  { id: 'code', title: 'Code', description: 'Implementation details' },
];

interface Props { mode: 'browser' | 'webview'; }

interface FileInfo {
  name: string;
  size: string;
  type: string;
  lastModified?: string;
}


export default function DocumentDemo({ mode }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<unknown>(null);
  const [apiSupported, setApiSupported] = useState<boolean | null>(null);
  const [fileTypes, setFileTypes] = useState<string[]>(['pdf', 'image']);
  const [multiple, setMultiple] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const markStepComplete = (step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  };

  const goToNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setStatus('idle');
      setResult(null);
    }
  };

  const checkSupport = async () => {
    setStatus('pending');
    setResult(null);
    
    if (mode === 'browser') {
      try {
        const hasFileInput = typeof document !== 'undefined' && 'createElement' in document;
        const hasFileSystemAccess = 'showOpenFilePicker' in window;
        const hasFileReader = 'FileReader' in window;
        
        setApiSupported(hasFileInput);
        setResult({ 
          fileInput: hasFileInput,
          FileSystemAccessAPI: hasFileSystemAccess,
          FileReader: hasFileReader,
          note: hasFileSystemAccess 
            ? 'Modern File System Access API available (Chrome/Edge)'
            : 'Using standard file input (works everywhere)'
        });
        setStatus(hasFileInput ? 'success' : 'error');
        if (hasFileInput) markStepComplete(1);
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Check failed' });
        setStatus('error');
      }
    } else {
      try {
        if (!window.NativeBridge?.checkFilePickerSupport) {
          throw new Error('NativeBridge.checkFilePickerSupport not available. Are you running in a WebView with native bridge?');
        }
        const res = callNativeBridge<{ supported: boolean; features: string[] }>(() => window.NativeBridge?.checkFilePickerSupport?.());
        if (res) { setApiSupported(res.supported);
        setResult(res);
        setStatus(res.supported ? 'success' : 'error');
        if (res.supported) markStepComplete(1); } else { throw new Error("Failed"); }
      } catch (err) {
        setApiSupported(false);
        setResult({ error: err instanceof Error ? err.message : 'Native bridge call failed' });
        setStatus('error');
      }
    }
  };

  const getAcceptString = () => {
    const types: string[] = [];
    if (fileTypes.includes('pdf')) types.push('application/pdf');
    if (fileTypes.includes('image')) types.push('image/*');
    if (fileTypes.includes('doc')) types.push('.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    return types.join(',');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' bytes';
  };

  const selectFiles = async () => {
    setStatus('pending');
    setResult(null);
    setSelectedFiles([]);
    
    if (mode === 'browser') {
      // Try File System Access API first (Chrome/Edge)
      if ('showOpenFilePicker' in window) {
        try {
          const acceptTypes: Record<string, string[]> = {};
          if (fileTypes.includes('pdf')) acceptTypes['application/pdf'] = ['.pdf'];
          if (fileTypes.includes('image')) acceptTypes['image/*'] = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
          if (fileTypes.includes('doc')) acceptTypes['application/msword'] = ['.doc', '.docx'];
          
          const handles = await window.showOpenFilePicker!({
            types: [{ description: 'Documents', accept: acceptTypes }],
            multiple,
          });
          
          const fileInfos: FileInfo[] = [];
          for (const handle of handles) {
            const file = await handle.getFile();
            fileInfos.push({
              name: file.name,
              size: formatFileSize(file.size),
              type: file.type || 'unknown',
              lastModified: new Date(file.lastModified).toISOString(),
            });
          }
          
          setSelectedFiles(fileInfos);
          setResult({ method: 'File System Access API', files: fileInfos });
          setStatus('success');
          markStepComplete(3);
          return;
        } catch (err) {
          if ((err as Error).name === 'AbortError') {
            setResult({ cancelled: true, message: 'User cancelled file selection' });
            setStatus('idle');
            return;
          }
          // Fall through to file input
        }
      }
      
      // Fallback to file input
      fileInputRef.current?.click();
    } else {
      try {
        if (!window.NativeBridge?.selectFiles) {
          throw new Error('NativeBridge.selectFiles not available');
        }
        const res = callNativeBridge<{ files: { name: string; size: string; type: string }[] }>(
          () => window.NativeBridge?.selectFiles?.(JSON.stringify({ types: fileTypes, multiple }))
        );
        if (res && res.files) {
          setSelectedFiles(res.files);
          setResult({ method: 'Native File Picker', files: res.files });
          setStatus(res.files.length > 0 ? 'success' : 'idle');
          if (res.files.length > 0) markStepComplete(3);
        } else {
          setResult({ note: 'File selection in progress or cancelled' });
          setStatus('idle');
        }
      } catch (err) {
        setResult({ error: err instanceof Error ? err.message : 'Native file picker failed' });
        setStatus('error');
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      setResult({ cancelled: true, message: 'No files selected' });
      setStatus('idle');
      return;
    }
    
    const fileInfos: FileInfo[] = files.map(f => ({
      name: f.name,
      size: formatFileSize(f.size),
      type: f.type || 'unknown',
      lastModified: new Date(f.lastModified).toISOString(),
    }));
    
    setSelectedFiles(fileInfos);
    setResult({ method: 'File Input', files: fileInfos });
    setStatus('success');
    markStepComplete(3);
    
    // Reset input for next selection
    e.target.value = '';
  };

  const browserCode = `// Method 1: Standard File Input (works everywhere)
const input = document.createElement('input');
input.type = 'file';
input.accept = 'application/pdf,image/*';
input.multiple = true;

input.onchange = (e) => {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    console.log(file.name, file.size, file.type);
    
    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result; // ArrayBuffer or string
    };
    reader.readAsArrayBuffer(file); // or readAsDataURL, readAsText
  });
};

input.click();

// Method 2: File System Access API (Chrome/Edge only)
const handles = await window.showOpenFilePicker({
  types: [{
    description: 'Documents',
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    }
  }],
  multiple: true,
  excludeAcceptAllOption: false,
});

for (const handle of handles) {
  const file = await handle.getFile();
  console.log(file.name, file.size, file.type);
  
  // Read content
  const content = await file.arrayBuffer();
  // or: const text = await file.text();
}

// Method 3: Drag and Drop
dropzone.ondragover = (e) => e.preventDefault();
dropzone.ondrop = (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  // Process files
};`;

  const webviewCode = `// JavaScript - Check support
const support = await window.NativeBridge.checkFilePickerSupport();
// Returns: { supported: true, features: ['gallery', 'camera', 'files'] }

// Select files
const result = await window.NativeBridge.selectFiles({
  types: ['pdf', 'image'],
  multiple: true
});
// Returns: { files: [{ name: 'doc.pdf', size: '2.4 MB', type: 'application/pdf' }] }

// Android Kotlin - Document Picker
class FileBridge(private val activity: Activity) {
  
  @JavascriptInterface
  fun selectFiles(optionsJson: String) {
    val options = JSONObject(optionsJson)
    val types = options.getJSONArray("types")
    val multiple = options.getBoolean("multiple")
    
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
      putExtra(Intent.EXTRA_MIME_TYPES, getMimeTypes(types))
      putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple)
    }
    
    activity.startActivityForResult(intent, FILE_PICKER_REQUEST)
  }
  
  private fun getMimeTypes(types: JSONArray): Array<String> {
    val mimes = mutableListOf<String>()
    for (i in 0 until types.length()) {
      when (types.getString(i)) {
        "pdf" -> mimes.add("application/pdf")
        "image" -> mimes.addAll(listOf("image/jpeg", "image/png", "image/gif"))
        "doc" -> mimes.addAll(listOf("application/msword", 
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
      }
    }
    return mimes.toTypedArray()
  }
  
  // Handle result
  fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode == FILE_PICKER_REQUEST && resultCode == RESULT_OK) {
      val files = mutableListOf<JSONObject>()
      
      val clipData = data?.clipData
      if (clipData != null) {
        for (i in 0 until clipData.itemCount) {
          files.add(getFileInfo(clipData.getItemAt(i).uri))
        }
      } else {
        data?.data?.let { files.add(getFileInfo(it)) }
      }
      
      webView.evaluateJavascript(
        "window.onFilesSelected({ files: \${JSONArray(files)} })", null
      )
    }
  }
}

// iOS Swift - Document Picker
class FileBridge: NSObject, UIDocumentPickerDelegate {
  
  func selectFiles(types: [String], multiple: Bool) {
    let utTypes = types.compactMap { getUTType($0) }
    let picker = UIDocumentPickerViewController(forOpeningContentTypes: utTypes)
    picker.allowsMultipleSelection = multiple
    picker.delegate = self
    viewController.present(picker, animated: true)
  }
  
  func documentPicker(_ controller: UIDocumentPickerViewController, 
                      didPickDocumentsAt urls: [URL]) {
    let files = urls.map { url -> [String: Any] in
      let attrs = try? FileManager.default.attributesOfItem(atPath: url.path)
      return [
        "name": url.lastPathComponent,
        "size": formatSize(attrs?[.size] as? Int ?? 0),
        "type": url.pathExtension
      ]
    }
    webView.evaluateJavaScript("window.onFilesSelected({ files: \\(files.jsonString) })")
  }
}`;

  const browserPros = [
    'Works on all browsers',
    'No native code needed',
    'Drag & drop support',
    'File System Access API for advanced use (Chrome)',
    'Can read file content directly',
  ];
  const browserCons = [
    'Cannot access device photos/gallery directly',
    'Limited file type icons',
    'No thumbnails preview (need to generate)',
    'Cannot access files outside user selection',
    'File System Access API not in Safari/Firefox',
  ];
  const webviewPros = [
    'Access to device gallery',
    'Native file picker UI',
    'Thumbnail previews',
    'Access to cloud storage (Drive, iCloud)',
    'Better file type handling',
    'Can access recently used files',
  ];
  const webviewCons = [
    'Requires native app',
    'Platform-specific implementation',
    'Need to handle file URIs carefully',
    'Content provider permissions (Android)',
    'Security scoped resources (iOS)',
  ];

  return (
    <div className="p-4">
      <Stepper steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} completedSteps={completedSteps} />
      <input 
        ref={fileInputRef} 
        type="file" 
        accept={getAcceptString()} 
        multiple={multiple} 
        onChange={handleFileInputChange}
        className="hidden" 
      />

      <div className="mt-4 space-y-4">
        {currentStep === 0 && (
          <Card title="Browser vs WebView: Document Upload" description="Compare file picker approaches">
            <div className="grid md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border ${mode === 'browser' ? 'border-accent bg-accent/10' : 'border-border'}`}>
                <h4 className="font-semibold mb-3">🌐 Browser Mode</h4>
                <div className="mb-3">
                  <div className="text-xs text-green-400 font-medium mb-1">PROS</div>
                  <ul className="text-sm space-y-1">
                    {browserPros.map((p, i) => <li key={i} className="text-text-muted">✓ {p}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-xs text-red-400 font-medium mb-1">CONS</div>
                  <ul className="text-sm space-y-1">
                    {browserCons.map((c, i) => <li key={i} className="text-text-muted">✗ {c}</li>)}
                  </ul>
                </div>
              </div>
              <div className={`p-4 rounded-lg border ${mode === 'webview' ? 'border-accent bg-accent/10' : 'border-border'}`}>
                <h4 className="font-semibold mb-3">📱 WebView Mode</h4>
                <div className="mb-3">
                  <div className="text-xs text-green-400 font-medium mb-1">PROS</div>
                  <ul className="text-sm space-y-1">
                    {webviewPros.map((p, i) => <li key={i} className="text-text-muted">✓ {p}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-xs text-red-400 font-medium mb-1">CONS</div>
                  <ul className="text-sm space-y-1">
                    {webviewCons.map((c, i) => <li key={i} className="text-text-muted">✗ {c}</li>)}
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-bg-elevated rounded-lg">
              <div className="text-sm font-medium mb-1">Recommendation</div>
              <p className="text-sm text-text-muted">
                Use <strong>Browser</strong> for simple document uploads. 
                Use <strong>WebView</strong> when you need gallery access, thumbnails, or cloud storage integration.
              </p>
            </div>
            <Button onClick={goToNextStep} className="mt-4">Continue to Implementation →</Button>
          </Card>
        )}

        {currentStep === 1 && (
          <Card title="Step 1: Check File Picker Support" description={mode === 'browser' ? 'File APIs' : 'Native document picker'}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatusBadge label="File Picker" value={apiSupported === null ? '—' : apiSupported ? '✓ Available' : '✗ No'} status={apiSupported === null ? 'idle' : apiSupported ? 'success' : 'error'} />
              <StatusBadge label="Mode" value={mode === 'browser' ? '🌐 Browser' : '📱 WebView'} status="idle" />
            </div>
            <Button onClick={checkSupport} loading={status === 'pending'}>Check File Picker Support</Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(1) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 2 && (
          <Card title="Step 2: Configure Options" description="Set allowed file types and selection mode">
            <div className="space-y-4 mb-4">
              <div>
                <div className="text-sm font-medium mb-2">File Types</div>
                <div className="flex gap-2">
                  {['pdf', 'image', 'doc'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFileTypes(prev => 
                        prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                      )}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        fileTypes.includes(type) 
                          ? 'bg-accent text-white' 
                          : 'bg-bg-elevated text-text-muted hover:text-text'
                      }`}
                    >
                      {type === 'pdf' ? '📄 PDF' : type === 'image' ? '🖼️ Images' : '📝 Docs'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Selection Mode</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMultiple(false)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      !multiple ? 'bg-accent text-white' : 'bg-bg-elevated text-text-muted hover:text-text'
                    }`}
                  >
                    Single File
                  </button>
                  <button
                    onClick={() => setMultiple(true)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      multiple ? 'bg-accent text-white' : 'bg-bg-elevated text-text-muted hover:text-text'
                    }`}
                  >
                    Multiple Files
                  </button>
                </div>
              </div>
            </div>
            <Button onClick={goToNextStep}>Continue →</Button>
          </Card>
        )}

        {currentStep === 3 && (
          <Card title="Step 3: Select Files" description="Open file picker dialog">
            {selectedFiles.length > 0 && (
              <div className="space-y-2 mb-4">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-bg-elevated rounded-lg">
                    <span className="text-xl">
                      {file.type.includes('pdf') ? '📄' : file.type.includes('image') ? '🖼️' : '📝'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{file.name}</div>
                      <div className="text-xs text-text-muted">{file.size} • {file.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button onClick={selectFiles} loading={status === 'pending'}>📁 Select Files</Button>
            {result !== null && <Result data={result} status={status} />}
            {completedSteps.has(3) && <Button onClick={goToNextStep} variant="secondary" className="mt-3">Next Step →</Button>}
          </Card>
        )}

        {currentStep === 4 && (
          <Card title="Implementation Code" description={`${mode === 'browser' ? 'Browser' : 'WebView + Native'} implementation`}>
            <CodeBlock code={mode === 'browser' ? browserCode : webviewCode} />
            <Button onClick={() => { setCurrentStep(0); setCompletedSteps(new Set()); setResult(null); setStatus('idle'); }} variant="ghost" className="mt-3">← Start Over</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
