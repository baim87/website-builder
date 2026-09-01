import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

describe('StorageService (e2e)', () => {
  let app: INestApplication;
  let storageService: StorageService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    storageService = app.get<StorageService>(StorageService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should upload a file successfully', async () => {
    const sendSpy = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as any);

    const result = await storageService.upload('test-key.txt', Buffer.from('hello'), 'text/plain');

    expect(sendSpy).toHaveBeenCalled();
    const command = sendSpy.mock.calls[0][0] as any;
    expect(command.input.Key).toBe('test-key.txt');
    expect(command.input.Body).toEqual(Buffer.from('hello'));
    
    expect(result).toBe('http://localhost:9000/test-bucket/test-key.txt');
  });

  it('should download a file successfully', async () => {
    const mockStream = new Readable();
    mockStream.push('hello');
    mockStream.push(null);

    const sendSpy = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({
      Body: mockStream,
    } as any);

    const result = await storageService.download('test-key.txt');

    expect(sendSpy).toHaveBeenCalled();
    const command = sendSpy.mock.calls[0][0] as any;
    expect(command.input.Key).toBe('test-key.txt');
    
    expect(result.toString()).toBe('hello');
  });

  it('should delete a file successfully', async () => {
    const sendSpy = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as any);

    await storageService.delete('test-key.txt');

    expect(sendSpy).toHaveBeenCalled();
    const command = sendSpy.mock.calls[0][0] as any;
    expect(command.input.Key).toBe('test-key.txt');
  });
});
