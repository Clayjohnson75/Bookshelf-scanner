#!/usr/bin/env python3
"""
HEIC to JPEG Converter
A simple desktop application for converting HEIC files to JPEG format.
Works with ALL HEIC files including problematic ones.
"""

import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import os
import subprocess
import sys
from pathlib import Path
import threading

class HEICConverter:
    def __init__(self, root):
        self.root = root
        self.root.title("HEIC to JPEG Converter")
        self.root.geometry("600x400")
        self.root.configure(bg='#f0f0f0')
        
        # Check if ImageMagick is installed
        self.check_imagemagick()
        
        self.setup_ui()
        
    def check_imagemagick(self):
        """Check if ImageMagick is installed"""
        try:
            subprocess.run(['convert', '-version'], capture_output=True, check=True)
            self.imagemagick_available = True
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.imagemagick_available = False
            
    def setup_ui(self):
        """Setup the user interface"""
        # Title
        title_label = tk.Label(
            self.root, 
            text="📸 HEIC to JPEG Converter", 
            font=('Arial', 20, 'bold'),
            bg='#f0f0f0',
            fg='#333'
        )
        title_label.pack(pady=20)
        
        # Description
        desc_label = tk.Label(
            self.root,
            text="Convert iPhone HEIC photos to JPEG format\nWorks with ALL HEIC files including problematic ones",
            font=('Arial', 12),
            bg='#f0f0f0',
            fg='#666',
            justify='center'
        )
        desc_label.pack(pady=10)
        
        # Status
        self.status_label = tk.Label(
            self.root,
            text="Ready to convert files",
            font=('Arial', 10),
            bg='#f0f0f0',
            fg='#333'
        )
        self.status_label.pack(pady=5)
        
        # ImageMagick status
        if self.imagemagick_available:
            magick_status = "✅ ImageMagick detected - Ready for conversion"
            magick_color = '#28a745'
        else:
            magick_status = "❌ ImageMagick not found - Please install ImageMagick"
            magick_color = '#dc3545'
            
        magick_label = tk.Label(
            self.root,
            text=magick_status,
            font=('Arial', 10, 'bold'),
            bg='#f0f0f0',
            fg=magick_color
        )
        magick_label.pack(pady=5)
        
        # Buttons frame
        buttons_frame = tk.Frame(self.root, bg='#f0f0f0')
        buttons_frame.pack(pady=20)
        
        # Convert single file button
        single_btn = tk.Button(
            buttons_frame,
            text="📁 Convert Single File",
            font=('Arial', 12, 'bold'),
            bg='#007bff',
            fg='white',
            padx=20,
            pady=10,
            command=self.convert_single_file,
            state='normal' if self.imagemagick_available else 'disabled'
        )
        single_btn.pack(side='left', padx=10)
        
        # Convert folder button
        folder_btn = tk.Button(
            buttons_frame,
            text="📂 Convert Folder",
            font=('Arial', 12, 'bold'),
            bg='#28a745',
            fg='white',
            padx=20,
            pady=10,
            command=self.convert_folder,
            state='normal' if self.imagemagick_available else 'disabled'
        )
        folder_btn.pack(side='left', padx=10)
        
        # Progress bar
        self.progress = ttk.Progressbar(
            self.root,
            mode='determinate',
            length=400
        )
        self.progress.pack(pady=20)
        
        # Results text area
        self.results_text = tk.Text(
            self.root,
            height=8,
            width=70,
            font=('Courier', 9),
            bg='#f8f9fa',
            fg='#333'
        )
        self.results_text.pack(pady=10, padx=20, fill='both', expand=True)
        
        # Install instructions
        if not self.imagemagick_available:
            install_frame = tk.Frame(self.root, bg='#f0f0f0')
            install_frame.pack(pady=10)
            
            install_label = tk.Label(
                install_frame,
                text="To install ImageMagick:",
                font=('Arial', 10, 'bold'),
                bg='#f0f0f0',
                fg='#333'
            )
            install_label.pack()
            
            install_text = tk.Text(
                install_frame,
                height=4,
                width=60,
                font=('Courier', 9),
                bg='#f8f9fa',
                fg='#333'
            )
            install_text.pack(pady=5)
            
            install_instructions = """Mac: brew install imagemagick
Windows: Download from https://imagemagick.org/script/download.php
Linux: sudo apt-get install imagemagick"""
            
            install_text.insert('1.0', install_instructions)
            install_text.config(state='disabled')
            
    def convert_single_file(self):
        """Convert a single HEIC file"""
        file_path = filedialog.askopenfilename(
            title="Select HEIC file to convert",
            filetypes=[("HEIC files", "*.heic *.HEIC"), ("All files", "*.*")]
        )
        
        if file_path:
            self.convert_files([file_path])
            
    def convert_folder(self):
        """Convert all HEIC files in a folder"""
        folder_path = filedialog.askdirectory(title="Select folder with HEIC files")
        
        if folder_path:
            # Find all HEIC files
            heic_files = []
            for ext in ['*.heic', '*.HEIC', '*.heif', '*.HEIF']:
                heic_files.extend(Path(folder_path).glob(ext))
            
            if heic_files:
                self.convert_files([str(f) for f in heic_files])
            else:
                messagebox.showinfo("No HEIC files", "No HEIC files found in the selected folder.")
                
    def convert_files(self, file_paths):
        """Convert multiple HEIC files"""
        if not self.imagemagick_available:
            messagebox.showerror("Error", "ImageMagick is not installed. Please install it first.")
            return
            
        # Run conversion in a separate thread
        thread = threading.Thread(target=self._convert_files_thread, args=(file_paths,))
        thread.daemon = True
        thread.start()
        
    def _convert_files_thread(self, file_paths):
        """Convert files in a separate thread"""
        total_files = len(file_paths)
        successful = 0
        failed = 0
        
        self.results_text.delete('1.0', tk.END)
        self.results_text.insert(tk.END, f"Converting {total_files} files...\n\n")
        
        for i, file_path in enumerate(file_paths):
            try:
                # Update progress
                progress = (i / total_files) * 100
                self.root.after(0, lambda p=progress: self.progress.config(value=p))
                
                # Convert file
                output_path = self.convert_heic_to_jpeg(file_path)
                
                if output_path:
                    successful += 1
                    self.root.after(0, lambda f=file_path, o=output_path: 
                        self.results_text.insert(tk.END, f"✅ {os.path.basename(f)} → {os.path.basename(o)}\n"))
                else:
                    failed += 1
                    self.root.after(0, lambda f=file_path: 
                        self.results_text.insert(tk.END, f"❌ Failed: {os.path.basename(f)}\n"))
                        
            except Exception as e:
                failed += 1
                self.root.after(0, lambda f=file_path, err=str(e): 
                    self.results_text.insert(tk.END, f"❌ Error: {os.path.basename(f)} - {err}\n"))
        
        # Update final progress
        self.root.after(0, lambda: self.progress.config(value=100))
        
        # Show final results
        self.root.after(0, lambda: self.results_text.insert(tk.END, 
            f"\n🎉 Conversion complete!\n✅ Successful: {successful}\n❌ Failed: {failed}\n"))
            
        self.root.after(0, lambda: self.status_label.config(text=f"Converted {successful}/{total_files} files"))
        
    def convert_heic_to_jpeg(self, input_path):
        """Convert a single HEIC file to JPEG using ImageMagick"""
        try:
            # Create output path
            input_file = Path(input_path)
            output_path = input_file.with_suffix('.jpg')
            
            # Use ImageMagick to convert
            cmd = ['convert', str(input_path), '-quality', '90', str(output_path)]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                return str(output_path)
            else:
                print(f"ImageMagick error: {result.stderr}")
                return None
                
        except Exception as e:
            print(f"Conversion error: {e}")
            return None

def main():
    root = tk.Tk()
    app = HEICConverter(root)
    root.mainloop()

if __name__ == "__main__":
    main()
