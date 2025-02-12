export default class Semaphore {
    constructor(max) {
      this.max = max;
      this.current = 0;
      this.queue = [];
    }
  
    acquire() {
      return new Promise((resolve) => {
        if (this.current < this.max) {
          this.current++;
          resolve();
        } else {
          this.queue.push(resolve);
        }
      });
    }
  
    release() {
      this.current--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }
  