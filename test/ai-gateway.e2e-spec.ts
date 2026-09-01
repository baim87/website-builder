import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AIGatewayService } from '../src/ai-gateway/ai-gateway.service';
import { ClaudeFableAdapter } from '../src/ai-gateway/adapters/claude-fable.adapter';
import { AIGatewayLogger } from '../src/ai-gateway/ai-gateway.logger';

describe('AIGatewayService (e2e)', () => {
  let app: INestApplication;
  let aiGatewayService: AIGatewayService;
  let logger: AIGatewayLogger;

  const mockClaudeAdapter = {
    generateText: jest.fn(),
    generateStream: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ClaudeFableAdapter)
      .useValue(mockClaudeAdapter)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    aiGatewayService = app.get<AIGatewayService>(AIGatewayService);
    logger = app.get<AIGatewayLogger>(AIGatewayLogger);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateText', () => {
    it('should generate text using the correct adapter and log the call', async () => {
      const mockResult = {
        text: 'Mocked AI response',
        usage: { promptTokens: 10, completionTokens: 20 },
      };
      mockClaudeAdapter.generateText.mockResolvedValue(mockResult);
      
      const logSpy = jest.spyOn(logger, 'logCall');

      const result = await aiGatewayService.generateText('claude-fable', {
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toEqual(mockResult);
      expect(mockClaudeAdapter.generateText).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(logSpy).toHaveBeenCalled();
      
      const logArgs = logSpy.mock.calls[0];
      expect(logArgs[0]).toBe('claude-fable'); // model
      expect(typeof logArgs[1]).toBe('number'); // latency
      expect(logArgs[2]).toEqual(mockResult.usage); // usage
    });

    it('should throw and log an error if generation fails', async () => {
      const mockError = new Error('AI Provider Error');
      mockClaudeAdapter.generateText.mockRejectedValue(mockError);
      
      const logErrorSpy = jest.spyOn(logger, 'logError');

      await expect(
        aiGatewayService.generateText('claude-fable', {
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      ).rejects.toThrow('AI Provider Error');

      expect(logErrorSpy).toHaveBeenCalledWith('claude-fable', mockError);
    });

    it('should throw if an unknown model is requested', async () => {
      await expect(
        aiGatewayService.generateText('unknown-model', {
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      ).rejects.toThrow('Unsupported model ID: unknown-model');
    });
  });

  describe('generateStream', () => {
    it('should generate a stream of text chunks', async () => {
      const asyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield { delta: 'Hello', isFinished: false };
          yield { delta: ' World', isFinished: true };
        },
      };

      mockClaudeAdapter.generateStream.mockReturnValue(asyncIterable);
      
      const stream = aiGatewayService.generateStream('claude-fable', {
        messages: [{ role: 'user', content: 'Hello' }],
      });

      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([
        { delta: 'Hello', isFinished: false },
        { delta: ' World', isFinished: true },
      ]);
    });
  });
});
