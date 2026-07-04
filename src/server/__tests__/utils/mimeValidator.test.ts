import { describe, it, expect } from 'vitest';
import { validateMimeType, getAllowedMimeTypes } from '../../utils/mimeValidator';

describe('validateMimeType', () => {
  // Valid PDF: magic bytes match declared type
  it('accepts valid PDF with correct magic bytes', () => {
    const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
    const result = validateMimeType('application/pdf', pdfBuffer);
    expect(result.valid).toBe(true);
  });

  // Valid PNG
  it('accepts valid PNG with correct magic bytes', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const result = validateMimeType('image/png', pngBuffer);
    expect(result.valid).toBe(true);
  });

  // Valid JPEG
  it('accepts valid JPEG with correct magic bytes', () => {
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const result = validateMimeType('image/jpeg', jpegBuffer);
    expect(result.valid).toBe(true);
  });

  // Disallowed MIME type
  it('rejects executable MIME type', () => {
    const buffer = Buffer.from([0x4D, 0x5A]); // MZ header
    const result = validateMimeType('application/x-msdownload', buffer);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('rejects application/x-sh', () => {
    const buffer = Buffer.from('#!/bin/bash\nrm -rf /');
    const result = validateMimeType('application/x-sh', buffer);
    expect(result.valid).toBe(false);
  });

  it('rejects text/html', () => {
    const buffer = Buffer.from('<html><script>alert(1)</script></html>');
    const result = validateMimeType('text/html', buffer);
    expect(result.valid).toBe(false);
  });

  // Content mismatch: declares PDF but is actually PNG
  it('rejects when magic bytes do not match declared type', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const result = validateMimeType('application/pdf', pngBuffer);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('does not match');
  });

  // Text-based types (no magic bytes to verify)
  it('accepts text/plain without magic byte check', () => {
    const buffer = Buffer.from('Hello, this is a plain text file.');
    const result = validateMimeType('text/plain', buffer);
    expect(result.valid).toBe(true);
  });

  it('accepts text/csv without magic byte check', () => {
    const buffer = Buffer.from('name,status\nTask 1,pending');
    const result = validateMimeType('text/csv', buffer);
    expect(result.valid).toBe(true);
  });

  it('accepts application/json without magic byte check', () => {
    const buffer = Buffer.from('{"key": "value"}');
    const result = validateMimeType('application/json', buffer);
    expect(result.valid).toBe(true);
  });

  // ZIP-based Office formats
  it('accepts DOCX with ZIP magic bytes', () => {
    const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const result = validateMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document', zipBuffer);
    expect(result.valid).toBe(true);
  });

  it('accepts XLSX with ZIP magic bytes', () => {
    const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const result = validateMimeType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', zipBuffer);
    expect(result.valid).toBe(true);
  });

  // Too-small file
  it('rejects files that are too small for binary types', () => {
    const buffer = Buffer.from([0x00]);
    const result = validateMimeType('application/pdf', buffer);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too small');
  });

  // MIME type with charset parameter
  it('handles MIME type with charset parameter', () => {
    const buffer = Buffer.from('plain text content');
    const result = validateMimeType('text/plain; charset=utf-8', buffer);
    expect(result.valid).toBe(true);
  });

  // getAllowedMimeTypes
  it('returns a sorted list of allowed types', () => {
    const types = getAllowedMimeTypes();
    expect(types.length).toBeGreaterThan(10);
    expect(types).toContain('application/pdf');
    expect(types).toContain('image/png');
    expect(types).not.toContain('application/x-msdownload');
  });
});
